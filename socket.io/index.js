const { Server } = require("socket.io");

const io = new Server({});


const Users = new Map()
const Apelidos = new Set()

io.on("connection", (socket) => {
  socket.on('get-user', (args, callback) => {
    if(!Users.get(args.id)) Users.get(args.id)
    try{
        callback(Users.get(args.id))
    }catch(e){}
  })

  socket.on('set-user', (args, callback) => {
    Users.set(args.id, args)
    try{
        callback(args)
    }catch(e){}
  })

  socket.on('get-apelido', (args, callback) => {
    try{
        callback(Apelidos.has(args))
    }catch(e){}
  })

  socket.on('set-apelido', (args, callback) => {
    Apelidos.add(args)
    try{
        callback(args)
    }catch(e){}
  })

  socket.on('search', (args, callback) => {
    let users = [];
    Users.forEach((user)=> {
        if(JSON.stringify(user).includes(args.query)) users.push(user)
    })
    try{
        callback(users.slice(0, 50))
    }catch(e){}
  })


});

io.listen(8080);