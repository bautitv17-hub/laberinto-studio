const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Guardamos las salas y sus jugadores
const salas = new Map();

// Crear un código de sala
function generarCodigo() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";

    for (let i = 0; i < 5; i++) {
        codigo += caracteres.charAt(
            Math.floor(Math.random() * caracteres.length)
        );
    }

    return codigo;
}

// Cuando un jugador se conecta
io.on("connection", (socket) => {
    console.log("Jugador conectado:", socket.id);

    // Crear una sala
    socket.on("crearSala", () => {
        let codigo;

        do {
            codigo = generarCodigo();
        } while (salas.has(codigo));

        salas.set(codigo, new Set([socket.id]));

        socket.join(codigo);
        socket.sala = codigo;

        socket.emit("salaCreada", {
            codigo: codigo,
            jugadores: 1
        });

        console.log(`Sala ${codigo} creada`);
    });

    // Unirse a una sala
    socket.on("unirseSala", (codigoRecibido) => {
        const codigo = String(codigoRecibido).trim().toUpperCase();
        const sala = salas.get(codigo);

        if (!sala) {
            socket.emit("errorSala", "La sala no existe.");
            return;
        }

        if (sala.size >= 4) {
            socket.emit("errorSala", "La sala está llena.");
            return;
        }

        if (socket.sala) {
            socket.leave(socket.sala);
            const salaAnterior = salas.get(socket.sala);

            if (salaAnterior) {
                salaAnterior.delete(socket.id);

                if (salaAnterior.size === 0) {
                    salas.delete(socket.sala);
                }
            }
        }

        sala.add(socket.id);
        socket.join(codigo);
        socket.sala = codigo;

        io.to(codigo).emit("actualizarJugadores", {
            codigo: codigo,
            jugadores: sala.size
        });

        console.log(`Jugador ${socket.id} se unió a ${codigo}`);
    });

    // Desconexión
    socket.on("disconnect", () => {
        if (socket.sala) {
            const sala = salas.get(socket.sala);

            if (sala) {
                sala.delete(socket.id);

                if (sala.size === 0) {
                    salas.delete(socket.sala);
                } else {
                    io.to(socket.sala).emit("actualizarJugadores", {
                        codigo: socket.sala,
                        jugadores: sala.size
                    });
                }
            }
        }

        console.log("Jugador desconectado:", socket.id);
    });
});

const PORT = 3000;

server.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});