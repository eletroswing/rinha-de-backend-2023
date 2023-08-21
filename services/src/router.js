class ServerRouter {
    constructor() {
        this.routes = new Map();
    }

    get(path, cb) {
        this.addRoute(path, 'GET', cb);
    }

    post(path, cb) {
        this.addRoute(path, 'POST', cb);
    }

    addRoute(path, method, cb) {
        if (!this.routes.has(path)) {
            this.routes.set(path, new Map());
        }
        this.routes.get(path).set(method, cb);
    }

    handle(path, method, req, res) {
        if (this.routes.has(path)) {
            const routeMethods = this.routes.get(path);
            if (routeMethods.has(method)) {
                return routeMethods.get(method)(req, res);
            }
        }
        
        const response = "HTTP/1.1 404 OK\r\nContent-Length: 9\r\n\r\nNot Found";
        res.write(response)
    }
}

module.exports = ServerRouter;
