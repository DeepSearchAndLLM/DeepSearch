const app = require("./src/app");
const { env } = require("./src/config/env");

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
