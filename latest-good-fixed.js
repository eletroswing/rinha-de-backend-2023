const http = require("http");
require("dotenv").config();
const uuid = require("uuid");
const format = require("pg-format");
const redis = require("redis");
const crypto = require("crypto");

const pool = require("./services/database");

const queryParse = require("./services/src/query-params");
const ServerRouter = require("./services/src/router");

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

var database;
ConnectToDb(ServicesConnected);

async function ConnectToDb(cb) {
  try {
    if (!database || database.ending) {
      database = await pool.connect();
    }
    await client.connect();
    await cb();
  } catch (err) {
    setTimeout(() => {
      ConnectToDb();
    }, 3000);
  }
}

async function ServicesConnected() {
  const users = await database.query("SELECT * FROM users");
  let apelidos = [];
  let usersMap = {};
  const userPromises = users.rows.map(async (user) => {
    apelidos.push(user.apelido);
    usersMap[user.id] = user;
    await client.set(`rinha:${user.id}`, JSON.stringify(user));
  });

  await Promise.all(userPromises);

  await client.set("rinha:apelido", JSON.stringify(apelidos));
  await client.set("rinha:users", JSON.stringify(usersMap));
}

const server = new http.Server({
  keepAliveTimeout: 20000,
  keepAlive: true,
});

var router = new ServerRouter();

/////////////////////////////////////////////////////////
var addToDB = [];

setInterval(push, 5000);

async function create(data) {
  await client.set("rinha:add", JSON.stringify(addToDB));
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
    await database.query(
      format(
        "INSERT INTO users(id, nome, apelido, nascimento, stack) VALUES %L",
        insertValues
      )
    );
  }

  addToDB = [];
  await client.set("rinha:add", JSON.stringify(addToDB));
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
    if (
      JSON.parse((await client.get("rinha:apelido")) || "[]").includes(
        req.body.apelido
      )
    ) {
      blocked = true;
      res.writeHead(422, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          message: "Apelido already exists.",
        })
      );
    }
    if (!blocked) {
      try {
        var id = uuid.v5(crypto.randomBytes(16).toString("hex"), uuid.v4());
        /////step 1 > done
        create({
          id: id,
          nome: req.body.nome,
          apelido: req.body.apelido,
          nascimento: req.body.nascimento,
          stack: req.body.stack,
        });

        //step 2
        let dt = JSON.parse((await client.get("rinha:users")) || "{}");
        dt[id] = {
          id: id,
          nome: req.body.nome,
          apelido: req.body.apelido,
          nascimento: req.body.nascimento,
          stack: req.body.stack,
        };
        await client.set("rinha:users", JSON.stringify(dt));

        //step 3
        await client.set(
          `rinha:${id}`,
          JSON.stringify({
            id: id,
            nome: req.body.nome,
            apelido: req.body.apelido,
            nascimento: req.body.nascimento,
            stack: req.body.stack,
          })
        );

        //step 4
        await client.set(
          "rinha:apelido",
          JSON.stringify([
            ...JSON.parse((await client.get("rinha:apelido")) || "[]"),
            req.body.apelido,
          ])
        );

        res.writeHead(201, {
          "Content-Type": "application/json",
          Location: `/pessoas/${id}`,
        });
        res.end(
          JSON.stringify({
            id: id,
            nome: req.body.nome,
            apelido: req.body.apelido,
            nascimento: req.body.nascimento,
            stack: req.body.stack,
          })
        );
      } catch (e) {
        res.writeHead(422, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            message: "Apelido already exists.",
          })
        );
      }
      return;
    }
  }
});

router.get("/contagem-pessoas", async (req, res) => {
  let queryResult = await database.query(
    `SELECT COUNT(*) AS count FROM users;`
  );
  res.writeHead(200);
  let users = JSON.parse(await client.get("rinha:add"));
  res.end(
    (Number(queryResult.rows[0].count) + (users?.length || 0)).toString()
  );
});

router.get("/pessoas", async (req, res) => {
  if (req.query.t) {
    var result = [];
    const keys = JSON.parse((await client.get("rinha:users")) || "{}");
    Object.keys(keys).forEach(async (key) => {
      let value = keys[key];
      if (JSON.stringify(value).includes(req.query.t)) result.push(value);
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(result.slice(0, 50)));
    return;
  } else {
    res.writeHead(400, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        message: "Missing t paramter.",
      })
    );
  }
});

router.get("/pessoas/*", async (req, res) => {
  let data = JSON.parse(await client.get(`rinha:${req.param}`));
  if (data) {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(data));
    return;
  } else {
    res.writeHead(404, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        message: "This user does't exists.",
      })
    );
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
    res.writeHead(422, { "Content-Type": "application/json" });
    const response = { error: error.message };
    res.end(JSON.stringify(response));
    return "error";
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += "" + chunk;
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

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

process.on("SIGINT", async () => {
  await push();
  if (database) {
    await database.release();
  }
  await client.del("rinha");
  await client.disconnect();
  process.exit();
});
