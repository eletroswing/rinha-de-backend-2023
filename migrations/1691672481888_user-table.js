exports.up = (pgm) => {
  pgm.createTable("users", {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('uuid_generate_v4()') },
    apelido: { type: 'string', notNull: true, unique: true, check: 'length(apelido) <= 32' },
    nome: { type: 'string', notNull: true, check: 'length(nome) <= 100'},
    stack: { type: 'text[]', default: null, check: 'array_length(stack, 1) <= 32'},
    nascimento: { type: 'string', notNull: true }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};
