import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("CAT1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEADER_LENGTH = MAGIC.length + IV_LENGTH;

function usage() {
  console.error(`Uso:
  node scripts/backup-crypto.mjs keygen --out <archivo.key>
  node scripts/backup-crypto.mjs pack --src <dir> --tar <archivo.tar>
  node scripts/backup-crypto.mjs encrypt --in <archivo.tar> --out <archivo.tar.aesgcm> --key <archivo.key>
  node scripts/backup-crypto.mjs decrypt --in <archivo.tar.aesgcm> --out <archivo.tar> --key <archivo.key>
  node scripts/backup-crypto.mjs verify --src <dir-plano> --tar <archivo.tar> --enc <archivo.tar.aesgcm> --key <archivo.key>
  node scripts/backup-crypto.mjs sha256 <archivo>`);
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) usage();
  return process.argv[index + 1];
}

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function listFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function inventory(root) {
  const files = listFiles(root);
  const hash = createHash("sha256");
  for (const file of files) {
    const rel = relative(root, file).split(sep).join("/");
    const digest = sha256File(file);
    hash.update(`${rel}\0${digest}\n`);
  }
  return {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
    treeHash: hash.digest("hex"),
  };
}

function readKey(path) {
  const key = readFileSync(path);
  if (key.length !== KEY_LENGTH) {
    throw new Error(`La clave debe tener exactamente ${KEY_LENGTH} bytes`);
  }
  return key;
}

function restrictAcl(path) {
  if (process.platform === "win32") {
    const user = process.env.USERNAME;
    if (!user) return;
    spawnSync("icacls", [path, "/inheritance:r", "/grant:r", `${user}:(R)`], {
      stdio: "ignore",
    });
    return;
  }
  chmodSync(path, 0o400);
}

function packTar(srcDir, tarPath) {
  mkdirSync(dirname(tarPath), { recursive: true });
  const parent = dirname(srcDir);
  const name = basename(srcDir);
  const result = spawnSync("tar", ["-cf", tarPath, "-C", parent, name], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("tar falló al empaquetar");
}

async function encrypt(inputPath, outputPath, keyPath) {
  const key = readKey(keyPath);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  mkdirSync(dirname(outputPath), { recursive: true });
  const output = createWriteStream(outputPath);
  await new Promise((resolveWrite, reject) => {
    output.write(Buffer.concat([MAGIC, iv]), (error) => (error ? reject(error) : resolveWrite()));
  });
  await pipeline(createReadStream(inputPath), cipher, output);
  const handle = openSync(outputPath, "a");
  try {
    writeFileSync(handle, cipher.getAuthTag());
  } finally {
    closeSync(handle);
  }
}

async function decrypt(inputPath, outputPath, keyPath) {
  const key = readKey(keyPath);
  const size = statSync(inputPath).size;
  if (size <= HEADER_LENGTH + TAG_LENGTH) throw new Error("Archivo cifrado inválido");
  const header = Buffer.alloc(HEADER_LENGTH);
  const tag = Buffer.alloc(TAG_LENGTH);
  const fd = openSync(inputPath, "r");
  try {
    readSync(fd, header, 0, HEADER_LENGTH, 0);
    readSync(fd, tag, 0, TAG_LENGTH, size - TAG_LENGTH);
  } finally {
    closeSync(fd);
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("El archivo no tiene el encabezado CAT1");
  }
  const iv = header.subarray(MAGIC.length);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  mkdirSync(dirname(outputPath), { recursive: true });
  const ciphertextLength = size - HEADER_LENGTH - TAG_LENGTH;
  const input = createReadStream(inputPath, {
    start: HEADER_LENGTH,
    end: HEADER_LENGTH + ciphertextLength - 1,
  });
  await pipeline(input, decipher, createWriteStream(outputPath));
}

async function verify({ src, tar, enc, key }) {
  const original = inventory(src);
  if (!existsSync(tar)) throw new Error("Falta el tar plano");
  const tarHash = sha256File(tar);
  const work = join(tmpdir(), `cat-backup-verify-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const decryptedTar = join(work, "restored.tar");
  const extracted = join(work, "extracted");
  mkdirSync(extracted);
  try {
    await decrypt(enc, decryptedTar, key);
    const restoredTarHash = sha256File(decryptedTar);
    if (restoredTarHash !== tarHash) {
      throw new Error("El tar descifrado no coincide con el tar original");
    }
    const extract = spawnSync("tar", ["-xf", decryptedTar, "-C", extracted], { stdio: "inherit" });
    if (extract.status !== 0) throw new Error("tar falló al extraer");
    const restoredRoot = join(extracted, basename(src));
    const restored = inventory(restoredRoot);
    if (restored.count !== original.count || restored.treeHash !== original.treeHash) {
      throw new Error("El árbol restaurado no coincide con el backup plano");
    }
    return {
      fileCount: original.count,
      bytes: original.bytes,
      treeHash: original.treeHash,
      tarSha256: tarHash,
      encSha256: sha256File(enc),
      dataSqlSha256: sha256File(join(src, "database", "data.sql")),
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const command = process.argv[2];

if (command === "keygen") {
  const out = resolve(arg("--out"));
  if (existsSync(out)) throw new Error("La clave ya existe; no se sobrescribe");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, randomBytes(KEY_LENGTH), { flag: "wx" });
  restrictAcl(out);
  console.log(`clave creada: ${out}`);
} else if (command === "pack") {
  packTar(resolve(arg("--src")), resolve(arg("--tar")));
  console.log(`tar: ${arg("--tar")}`);
  console.log(`sha256: ${sha256File(resolve(arg("--tar")))}`);
} else if (command === "encrypt") {
  await encrypt(resolve(arg("--in")), resolve(arg("--out")), resolve(arg("--key")));
  console.log(`cifrado: ${arg("--out")}`);
  console.log(`sha256: ${sha256File(resolve(arg("--out")))}`);
} else if (command === "decrypt") {
  await decrypt(resolve(arg("--in")), resolve(arg("--out")), resolve(arg("--key")));
  console.log(`descifrado: ${arg("--out")}`);
  console.log(`sha256: ${sha256File(resolve(arg("--out")))}`);
} else if (command === "verify") {
  const result = await verify({
    src: resolve(arg("--src")),
    tar: resolve(arg("--tar")),
    enc: resolve(arg("--enc")),
    key: resolve(arg("--key")),
  });
  console.log(JSON.stringify(result, null, 2));
} else if (command === "sha256") {
  const file = resolve(process.argv[3] ?? "");
  if (!file || !existsSync(file)) usage();
  console.log(sha256File(file));
} else {
  usage();
}
