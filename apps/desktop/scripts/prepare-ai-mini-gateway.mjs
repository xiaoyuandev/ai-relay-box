import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(__dirname, "..", "..", "..");
const desktopDir = join(workspaceRoot, "apps", "desktop");
const resourcesDir = join(desktopDir, "resources", "ai-mini-gateway");
const manifestPath = join(resourcesDir, "manifest.json");
const outputBinDir = join(resourcesDir, "bin");
const versionMetadataPath = join(resourcesDir, "version.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const goos = process.env.AI_MINI_GATEWAY_GOOS || mapPlatform(process.platform);
const goarch = process.env.AI_MINI_GATEWAY_GOARCH || mapArch(process.arch);

if (!goos) {
  console.error(`[prepare-ai-mini-gateway] unsupported Node platform: ${process.platform}`);
  process.exit(1);
}

if (!goarch) {
  console.error(`[prepare-ai-mini-gateway] unsupported Node architecture: ${process.arch}`);
  process.exit(1);
}

const binaryName = goos === "windows" ? "ai-mini-gateway.exe" : "ai-mini-gateway";
const archiveExtension = goos === "windows" ? ".zip" : ".tar.gz";
const assetBase = `ai-mini-gateway_${manifest.version}_${goos}_${goarch}`;
const assetFileName = `${assetBase}${archiveExtension}`;
const archivePath = process.env.AI_MINI_GATEWAY_RELEASE_ASSET || "";
const downloadURL =
  process.env.AI_MINI_GATEWAY_RELEASE_ASSET_URL ||
  `https://github.com/${manifest.release_repo}/releases/download/${manifest.version}/${assetFileName}`;

mkdirSync(outputBinDir, { recursive: true });

const tempDir = mkdtempSync(join(tmpdir(), "ai-mini-gateway-"));

try {
  const preparedArchivePath = archivePath || (await downloadReleaseAsset(downloadURL, join(tempDir, assetFileName)));
  extractArchive(preparedArchivePath, archiveExtension, tempDir);

  const extractedBinaryPath = join(tempDir, assetBase, binaryName);
  if (!existsSync(extractedBinaryPath)) {
    throw new Error(
      `expected extracted binary at ${extractedBinaryPath}, but it was not found`
    );
  }

  const outputBinaryPath = join(outputBinDir, binaryName);
  copyFileSync(extractedBinaryPath, outputBinaryPath);
  if (goos !== "windows") {
    chmodSync(outputBinaryPath, 0o755);
  }

  writeFileSync(
    versionMetadataPath,
    `${JSON.stringify(
      {
        runtime_kind: manifest.runtime_kind,
        version: manifest.version,
        commit: manifest.commit,
        contract_version: manifest.contract_version,
        source_commit_time: manifest.source_commit_time,
        source_url: downloadURL,
        prepared_at: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );

  console.log(
    `[prepare-ai-mini-gateway] prepared ${manifest.version} (${manifest.commit}) for ${goos}/${goarch} -> ${outputBinaryPath}`
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

async function downloadReleaseAsset(url, destinationPath) {
  console.log(`[prepare-ai-mini-gateway] downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(destinationPath, Buffer.from(arrayBuffer));
  return destinationPath;
}

function extractArchive(archivePath, archiveExtension, destinationDir) {
  if (archiveExtension === ".tar.gz") {
    runCommand("tar", ["-xzf", archivePath, "-C", destinationDir], "extract tar.gz archive");
    return;
  }

  if (process.platform === "win32") {
    runCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
      ],
      "extract zip archive"
    );
    return;
  }

  runCommand("unzip", ["-q", archivePath, "-d", destinationDir], "extract zip archive");
}

function runCommand(command, args, description) {
  const result = spawnSync(command, args, {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 1}`);
  }
}

function mapPlatform(platform) {
  switch (platform) {
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return null;
  }
}

function mapArch(arch) {
  switch (arch) {
    case "arm64":
      return "arm64";
    case "x64":
      return "amd64";
    default:
      return null;
  }
}
