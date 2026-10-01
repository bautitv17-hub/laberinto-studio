const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");


// =========================================================
// SERVIDOR
// =========================================================

const app = express();

const server =
    http.createServer(app);


const io =
    new Server(server, {

        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }

    });


// =========================================================
// CARPETA PUBLIC
// =========================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =========================================================
// RUTA PRINCIPAL
// =========================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


// =========================================================
// SALAS
// =========================================================

const salas =
    new Map();


// =========================================================
// CONFIGURACIÓN
// =========================================================

const MAX_JUGADORES =
    4;


const POSICIONES = [

    {
        x: 30,
        y: 30
    },

    {
        x: 710,
        y: 30
    },

    {
        x: 30,
        y: 590
    },

    {
        x: 710,
        y: 590
    }

];


// =========================================================
// GENERAR CÓDIGO
// =========================================================

function generarCodigo() {

    const caracteres =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let codigo;


    do {

        codigo = "";


        for (
            let i = 0;
            i < 5;
            i++
        ) {

            const posicion =
                Math.floor(
                    Math.random() *
                    caracteres.length
                );


            codigo +=
                caracteres[posicion];

        }

    }
    while (
        salas.has(codigo)
    );


    return codigo;

}


// =========================================================
// CREAR LISTA DE JUGADORES
// =========================================================

function obtenerJugadores(codigo) {

    const sala =
        salas.get(codigo);


    if (!sala) {

        return [];

    }


    return Array.from(
        sala.values()
    ).map(
        jugador => {

            return {

                id:
                    String(jugador.id),

                x:
                    Number(jugador.x),

                y:
                    Number(jugador.y)

            };

        }
    );

}


// =========================================================
// ENVIAR JUGADORES A TODA LA SALA
// =========================================================

function actualizarSala(codigo) {

    const sala =
        salas.get(codigo);


    if (!sala) {

        return;

    }


    const jugadores =
        obtenerJugadores(codigo);


    /*
        Siempre mandamos un ARRAY.
    */

    io.to(codigo).emit(
        "actualizarJugadores",
        jugadores
    );

}


// =========================================================
// CONEXIÓN
// =========================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "================================"
        );

        console.log(
            "Jugador conectado:",
            socket.id
        );

        console.log(
            "================================"
        );


        // =====================================================
        // CREAR SALA
        // =====================================================

        socket.on(
            "crearSala",
            () => {

                if (
                    socket.sala
                ) {

                    socket.emit(
                        "errorSala",
                        "Ya estás dentro de una sala."
                    );

                    return;

                }


                const codigo =
                    generarCodigo();


                const sala =
                    new Map();


                const posicion =
                    POSICIONES[0];


                const jugador = {

                    id:
                        socket.id,

                    x:
                        posicion.x,

                    y:
                        posicion.y

                };


                sala.set(
                    socket.id,
                    jugador
                );


                salas.set(
                    codigo,
                    sala
                );


                socket.join(
                    codigo
                );


                socket.sala =
                    codigo;


                console.log(
                    `Sala creada: ${codigo}`
                );


                console.log(
                    `Creador: ${socket.id}`
                );


                socket.emit(
                    "salaCreada",
                    {
                        codigo
                    }
                );


                actualizarSala(
                    codigo
                );

            }
        );



        // =====================================================
        // UNIRSE A SALA
        // =====================================================

        socket.on(
            "unirseSala",
            (codigoRecibido) => {

                if (
                    typeof codigoRecibido !==
                    "string"
                ) {

                    socket.emit(
                        "errorSala",
                        "El código de sala no es válido."
                    );

                    return;

                }


                const codigo =
                    codigoRecibido
                        .trim()
                        .toUpperCase();


                console.log(
                    `${socket.id} quiere entrar a ${codigo}`
                );


                if (
                    codigo.length !== 5
                ) {

                    socket.emit(
                        "errorSala",
                        "El código debe tener 5 caracteres."
                    );

                    return;

                }


                const sala =
                    salas.get(codigo);


                if (!sala) {

                    socket.emit(
                        "errorSala",
                        "La sala no existe."
                    );

                    return;

                }


                if (
                    sala.size >=
                    MAX_JUGADORES
                ) {

                    socket.emit(
                        "errorSala",
                        "La sala está llena."
                    );

                    return;

                }


                // Ya está en esa sala

                if (
                    socket.sala === codigo
                ) {

                    socket.emit(
                        "salaUnida",
                        {
                            codigo
                        }
                    );


                    actualizarSala(
                        codigo
                    );


                    return;

                }



                // =================================================
                // SALA ANTERIOR
                // =================================================

                if (
                    socket.sala
                ) {

                    const codigoAnterior =
                        socket.sala;


                    const salaAnterior =
                        salas.get(
                            codigoAnterior
                        );


                    if (
                        salaAnterior
                    ) {

                        salaAnterior.delete(
                            socket.id
                        );


                        if (
                            salaAnterior.size ===
                            0
                        ) {

                            salas.delete(
                                codigoAnterior
                            );

                        }

                        else {

                            actualizarSala(
                                codigoAnterior
                            );

                        }

                    }


                    socket.leave(
                        codigoAnterior
                    );


                    socket.sala =
                        null;

                }



                // =================================================
                // POSICIÓN
                // =================================================

                const numeroJugador =
                    sala.size;


                const posicion =
                    POSICIONES[
                        numeroJugador
                    ] ||
                    {
                        x: 30,
                        y: 30
                    };


                const jugador = {

                    id:
                        socket.id,

                    x:
                        posicion.x,

                    y:
                        posicion.y

                };


                sala.set(
                    socket.id,
                    jugador
                );


                socket.join(
                    codigo
                );


                socket.sala =
                    codigo;


                console.log(
                    `Jugador ${socket.id} entró a ${codigo}`
                );


                socket.emit(
                    "salaUnida",
                    {
                        codigo
                    }
                );


                actualizarSala(
                    codigo
                );

            }
        );



        // =====================================================
        // MOVIMIENTO
        // =====================================================

        socket.on(
            "moverJugador",
            (datos) => {

                if (
                    !socket.sala
                ) {

                    return;

                }


                const sala =
                    salas.get(
                        socket.sala
                    );


                if (!sala) {

                    return;

                }


                const jugador =
                    sala.get(
                        socket.id
                    );


                if (!jugador) {

                    return;

                }


                if (
                    !datos ||
                    typeof datos !== "object"
                ) {

                    return;

                }


                const x =
                    Number(datos.x);


                const y =
                    Number(datos.y);


                if (
                    !Number.isFinite(x) ||
                    !Number.isFinite(y)
                ) {

                    return;

                }


                // =================================================
                // LIMITAR AL CANVAS
                // =================================================

                jugador.x =
                    Math.max(
                        8,
                        Math.min(
                            772,
                            x
                        )
                    );


                jugador.y =
                    Math.max(
                        8,
                        Math.min(
                            612,
                            y
                        )
                    );


                // =================================================
                // ACTUALIZAR SALA
                // =================================================

                actualizarSala(
                    socket.sala
                );

            }
        );



        // =====================================================
        // DESCONEXIÓN
        // =====================================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Jugador desconectado:",
                    socket.id
                );


                const codigo =
                    socket.sala;


                if (!codigo) {

                    return;

                }


                const sala =
                    salas.get(codigo);


                if (!sala) {

                    return;

                }


                sala.delete(
                    socket.id
                );


                if (
                    sala.size === 0
                ) {

                    salas.delete(
                        codigo
                    );


                    console.log(
                        `Sala ${codigo} eliminada`
                    );

                }

                else {

                    actualizarSala(
                        codigo
                    );

                }

            }
        );

    }
);


// =========================================================
// SERVIDOR
// =========================================================

const PORT =
    process.env.PORT || 3000;


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================"
        );

        console.log(
            `Servidor iniciado en puerto ${PORT}`
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "================================"
        );

    }
);
