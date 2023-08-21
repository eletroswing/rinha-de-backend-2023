const TCP = require("./services/tcp");
require("dotenv").config();
const uuid = require("uuid");
const format = require("pg-format");
const crypto = require("crypto");

const { io } = require("socket.io-client");

const pool = require("./services/database");

const queryParse = require("./services/src/query-params");
const ServerRouter = require("./services/src/router");

var database;
var pubsub;
ConnectToDb(ServicesConnected);

async function ConnectToDb(cb) {
  try {
    if (!database || database.ending) {
      database = await pool.connect();
    }
    pubsub = io(process.env.WS || "ws://localhost:8080/");
    await cb();
  } catch (err) {
    setTimeout(() => {
      ConnectToDb();
    }, 3000);
  }
}

async function ServicesConnected() {
  const users = await database.query("SELECT * FROM users");
  const userPromises = users.rows.map(async (user) => {
    await pubsub.emit("set-user", user);
    await pubsub.emit("set-apelido", user.apelido);
  });

  await Promise.all(userPromises);
}

const server = new TCP();

var router = new ServerRouter();

/////////////////////////////////////////////////////////
var addToDB = [];

setInterval(push, 3000);

async function create(data) {
  addToDB.push(data);
}

async function push() {
  if (addToDB.length > 0) {
    const insertValues = addToDB.map((user) => [
      user.id,
      user.nome,
      user.apelido,
      user.nascimento,
      `{${user.stack ? user.stack.join(",") : ""}}`, // Transforma o array em uma string no formato "{elemento1,elemento2}"
    ]);
    try {
      await database.query(
        format(
          "INSERT INTO users(id, nome, apelido, nascimento, stack) VALUES %L",
          insertValues
        )
      );
    } catch (e) {}
  }
  addToDB = [];
}

router.post("/pessoas", async (req, res) => {
  const validated = ValidateBody(
    {
      nome: { required: true, type: "string", format: /^.{1,100}$/ },
      apelido: { required: true, type: "string", format: /^.{1,32}$/ },
      nascimento: {
        required: true,
        type: "string",
        format: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
      },
      stack: { required: false, type: "object", format: /^.{1,32}$/ },
    },
    req,
    res
  );

  if (!validated) {
    //first, need to be a unique apelido
    var blocked = false;
    let has = await new Promise((resolve, reject) => {
      pubsub.emit("get-apelido", req.body.apelido, (res) => resolve(res));
    });
    if (has) {
      blocked = true;
      const responseText = JSON.stringify({
        message: "Apelido already exists.",
      });
      const response = `HTTP/1.1 422 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
      res.write(response);
    }
    if (!blocked) {
      try {
        var id = uuid.v5(
          crypto.randomBytes(32).toString("hex"),
          uuid.v5(req.body.apelido, uuid.v4())
        );
        /////step 1 > done
        create({
          id: id,
          nome: req.body.nome,
          apelido: req.body.apelido,
          nascimento: req.body.nascimento,
          stack: req.body.stack,
        });

        await new Promise((resolve, reject) => {
          pubsub.emit(
            "set-user",
            {
              id: id,
              nome: req.body.nome,
              apelido: req.body.apelido,
              nascimento: req.body.nascimento,
              stack: req.body.stack,
            },
            (res) => resolve(res)
          );
        });

        await new Promise((resolve, reject) => {
          pubsub.emit("set-apelido", req.body.apelido, (res) => resolve(res));
        });

        const responseText = JSON.stringify({
          id: id,
          nome: req.body.nome,
          apelido: req.body.apelido,
          nascimento: req.body.nascimento,
          stack: req.body.stack,
        });
        const response = `HTTP/1.1 201 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\nLocation: /pessoas/${id}\r\n\r\n${responseText}`;
        res.write(response);
      } catch (e) {
        const responseText = JSON.stringify({
          message: "Apelido already exists.",
        });
        const response = `HTTP/1.1 422 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
        res.write(response);
      }
      return;
    }
  }
});

router.get("/contagem-pessoas", async (req, res) => {
  let queryResult = await database.query(
    `SELECT COUNT(*) AS count FROM users;`
  );
  const responseText = queryResult.rows[0].count;
  const response = `HTTP/1.1 200 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\n\r\n${responseText}`;
  res.write(response);
});

router.get("/pessoas", async (req, res) => {
  if (req.query.t) {
    let query = await new Promise((resolve, reject) => {
      pubsub.emit("search", { query: req.query.t }, (res) => resolve(res));
    });
    const responseText = JSON.stringify(query);
    const response = `HTTP/1.1 200 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
    res.write(response);
    return;
  } else {
    const responseText = JSON.stringify({
      message: "Missing t paramter.",
    });
    const response = `HTTP/1.1 400 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
    res.write(response);
  }
});

router.get("/pessoas/*", async (req, res) => {
  let data = await new Promise((resolve, reject) => {
    pubsub.emit("get-user", { id: req.param }, (res) => resolve(res));
  });

  if (data) {
    const responseText = JSON.stringify(data);
    const response = `HTTP/1.1 200 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
    res.write(response);
    return;
  } else {
    const responseText = JSON.stringify({
      message: "This user does't exists.",
    });
    const response = `HTTP/1.1 400 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
    res.write(response);
  }
});
/////////////////////////////////////////////////////////

function ValidateBody(validationSchema, req, res) {
  try {
    const requestData = req.body;

    for (const key in validationSchema) {
      const rules = validationSchema[key];
      const value = requestData[key];

      if (rules.required && !value) {
        throw new Error(`'${key}' is required.`);
      }

      if (value) {
        if (rules.type && typeof value !== rules.type) {
          throw new Error(`'${key}' must be of type ${rules.type}.`);
        }

        if (
          rules.format &&
          rules.type !== "object" &&
          !rules.format.test(value)
        ) {
          throw new Error(
            `'${key}' format is invalid, must be: ${rules.format}`
          );
        }

        if (Array.isArray(value)) {
          for (const element of value) {
            if (typeof element !== (rules.itemType || "string")) {
              throw new Error(
                `Each element in '${key}' array must be a ${
                  rules.itemType || "string"
                }.`
              );
            }

            if (!rules.format.test(element)) {
              throw new Error(
                `Element in '${key}' array has invalid format. Must match: ${rules.format}`
              );
            }
          }
        }
      }
    }
  } catch (error) {
    const responseText = JSON.stringify({ error: error.message });
    const response = `HTTP/1.1 422 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: ${responseText.length}\r\nContent-Type: application/json\r\n\r\n${responseText}`;
    res.write(response);
    return "error";
  }
}

server.on("connection", async (socket, headers, body) => {
  var req = {};
  const firstLine = headers.split("\r\n")[0];
  const [method, url, httpVersion] = firstLine.split(" ");
  req.query = queryParse(url);

  try {
    body = body ? JSON.parse(body) : {};
  } catch (e) {
    body = {};
  }
  req.body = body;
  req.url = url || "";
  req.method = method;
  if (req.url.split("/").length > 2) {
    req.param = req.url.split("/")[2];
    req.url = `/${req.url.split("/")[1]}/*`;
  }
  router.handle(req.url.split("?")[0], req.method, req, socket);

  //  const response = "HTTP/1.1 200 OK\r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nConnection: Keep-Alive\r\nKeep-Alive: timeout=100, max=1000 \r\nContent-Length: 13\r\n\r\nHello, World!";
  //  socket.write(response);
});

server.listen(process.env.PORT || 3000);
console.log("Server listening on port", process.env.PORT || 3000);
process.on("SIGINT", async () => {
  await push();
  if (database) {
    await database.release();
  }
  process.exit();
});

process.on("uncaughtException", (err) => {});

/*
server
  .on("request", async (req, res) => {
    req.query = queryParse(req.url);
    let body = await readBody(req);
    try {
      body = body ? JSON.parse(body) : {};
    } catch (e) {
      body = {};
    }

    req.body = body;

    if (req.url.split("/").length > 2) {
      req.param = req.url.split("/")[2];
      req.url = `/${req.url.split("/")[1]}/*`;
    }
    router.handle(req.url.split("?")[0], req.method, req, res);
  })
  .listen(process.env.PORT || 3000, () => console.log(process.env.PORT));
*/
