const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("Usage: node scripts/generate-password-hash.js <plain-password>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
