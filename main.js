const server = require("./services/src/app");
const applicationInstance = server();
const pool = require("./services/database");
var database;
ConnectToDb();

async function ConnectToDb() {
  database = await pool.connect();
}

const validateJsonBody = require("./services/middlewares/validate.middleware");

applicationInstance.post(
  "/pessoas",
  validateJsonBody({
    nome: { required: true, type: "string", format: /^.{1,100}$/ },
    apelido: { required: true, type: "string", format: /^.{1,32}$/ },
    nascimento: {
      required: true,
      type: "string",
      format: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
    },
    stack: { required: false, type: "object", format: /^.{1,32}$/ },
  }),
  async (req, res) => {
    try {
      const text =
        "INSERT INTO users(nome, apelido, nascimento, stack) VALUES($1, $2, $3, $4) RETURNING *";
      const values = [
        req.body.nome,
        req.body.apelido,
        req.body.nascimento,
        req.body.stack,
      ];

      let queryResult = await database.query(text, values);

      res.writeHead(201, {
        "Content-Type": "application/json",
        Location: `/pessoas/${queryResult.rows[0].id}`,
      });
      res.end(JSON.stringify(queryResult.rows[0]));
    } catch (e) {
      if (
        e.message ==
        'duplicate key value violates unique constraint "users_apelido_key"'
      ) {
        res.writeHead(422, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            message: "Apelido already exists.",
          })
        );
      }
    }
  }
);

applicationInstance.get("/pessoas/:uuid", async (req, res) => {
  if (req.params.uuid) {
    const uuidPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

    if (!uuidPattern.test(req.params.uuid)) {
      res.writeHead(422, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          message: "The id must be in uuid format.",
        })
      );

      return;
    }

    const text = "SELECT * FROM users WHERE id=$1;";
    const values = [req.params.uuid];

    let queryResult = await database.query(text, values);

    if (queryResult.rows[0]) {
      res.writeHead(200, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(queryResult.rows[0]));
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
    return;
  }
});

applicationInstance.get("/pessoas", async (req, res) => {
  if (!req.query.t) {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({}));

    return;
  }

  let queryResult = await database.query(
    `SELECT *
    FROM users
    WHERE nome ILIKE $1 
      OR  $2 = Any(stack)
      OR apelido ILIKE $3
    ORDER BY nome, stack, apelido
    LIMIT 50;`,
    [`%${req.query.t}%`, req.query.t ,`%${req.query.t}%`]
  );

  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(queryResult.rows));
});

applicationInstance.get("/contagem-pessoas", async (req, res) => {
  let queryResult = await database.query(
    `SELECT COUNT(*) AS count FROM users;`
  );
  res.writeHead(200);
  res.end(queryResult.rows[0].count);
});

const port = process.env.PORT || 3001;
applicationInstance.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
