const bcrypt = require("./node_modules/bcryptjs");
const db = require("./database");
const password = process.argv[2];
if (!password || password.length < 8) { console.error("Password lazima iwe na angalau characters 8."); process.exit(1); }
const hash = bcrypt.hashSync(password, 12);
db.prepare("UPDATE admins SET password_hash = ? WHERE username = ?").run(hash, "admin@zenodic.com");
db.prepare("UPDATE admin_gateway SET password_hash = ? WHERE email = ?").run(hash, "admin@zenodic.com");
console.log("ADMIN_AND_GATEWAY_PASSWORD_RESET_OK");
