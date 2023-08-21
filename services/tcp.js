const { TCP, constants } = process.binding("tcp_wrap");
const { EventEmitter } = require("events");
const { Socket: NTSocket } = require("net");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Server extends EventEmitter {
  constructor() {
    super();
    this._handle = null;
    this._connections = 0;
  }

  listen(port, address) {
    const handle = new TCP(constants.SERVER);

    handle.bind(address || "0.0.0.0", port);
    const err = handle.listen(511); // Backlog size

    if (err) {
      handle.close();
      throw new Error(`Error listening: ${err}`);
    }

    this._handle = handle;
    this._handle.onconnection = this.onconnection.bind(this);
  }

  onconnection(err, clientHandle) {
    if (err) {
      console.error("Error accepting connection:", err);
      return;
    }

    const socket = new NTSocket({ handle: clientHandle });
    this._connections++;
    socket.server = this;
    socket._server = this;

    // Handle data received from the client
    socket._handle.onread = (...args)  => {
      try {
        const uint8Array = new Uint8Array(args[0]);
        const data = new TextDecoder().decode(uint8Array);
        const [headers, body] = data.split("\r\n\r\n");
        this.emit("connection", socket, headers, body);
      } catch (error) {
        socket._handle.readStop(); // Stop further reading
        socket.close(); // Close the socket
      }
    }
    
    socket._handle.onerror = (err) => {
      if (err.code === "ECONNABORTED") {
        // Handle ECONNABORTED error
        socket.close(); // Close the socket
      }
    };
    socket._handle.readStart();
  }

  close() {
    if (this._handle) {
      this._handle.close();
      this._handle = null;
    }
  }
}

module.exports = Server;
/*
const server = new Server();

server.on("connection", async (socket, headers, body) => {
  const response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello, World!";
  socket.write(response);
});

server.listen(3000);
console.log("Server listening on port 3000");*/
