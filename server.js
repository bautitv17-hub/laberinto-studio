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
//
// Cada sala queda así:
//
// sala -> Map
//
// Map:
//
// socketId -> {
//     id,
//     x,
//     y
// }
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


    /*
        SIEMPRE devuelve un ARRAY.

        Nunca devuelve el Map.

        Nunca devuelve:

        {
            codigo,
            jugadores
        }
    */


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


    console.log(
        "Actualizando sala:",
        codigo,
        "Jugadores:",
        jugadores
    );


    /*
        IMPORTANTE:

        El segundo argumento es SIEMPRE
        el ARRAY de jugadores.
    */

    io.to(codigo).emit(
        "actualizarJugadores",
        jugadores
    );

}


// =========================================================
// CONEXIÓN DE JUGADORES
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

                // Si ya estaba en una sala,
                // no permitimos crear otra encima.

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


                // Confirmación

                socket.emit(
                    "salaCreada",
                    {

                        codigo:
                            codigo

                    }
                );


                // Lista inicial

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

                // Validar

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


                // Código incorrecto

                if (
                    codigo.length !== 5
                ) {

                    socket.emit(
                        "errorSala",
                        "El código debe tener 5 caracteres."
                    );

                    return;

                }


                // Buscar sala

                const sala =
                    salas.get(codigo);


                if (!sala) {

                    socket.emit(
                        "errorSala",
                        "La sala no existe."
                    );

                    return;

                }


                // Sala llena

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


                // Si ya está en esa misma sala

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
                // SACARLO DE SU SALA ANTERIOR
                // =================================================

                if (
                    socket.sala
                ) {

                    const salaAnterior =
                        salas.get(
                            socket.sala
                        );


                    const codigoAnterior =
                        socket.sala;


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
                // POSICIÓN DEL NUEVO JUGADOR
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


                // Guardar

                sala.set(
                    socket.id,
                    jugador
                );


                // Unir Socket.IO

                socket.join(
                    codigo
                );


                socket.sala =
                    codigo;


                console.log(
                    `Jugador ${socket.id} entró a ${codigo}`
                );


                // =================================================
                // CONFIRMAR AL NUEVO JUGADOR
                // =================================================

                socket.emit(
                    "salaUnida",
                    {

                        codigo:
                            codigo

                    }
                );


                // =================================================
                // ACTUALIZAR A TODOS
                // =================================================

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

                // No tiene sala

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


                // Buscar jugador

                const jugador =
                    sala.get(
                        socket.id
                    );


                if (!jugador) {

                    return;

                }


                // Validar datos

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


                // Limitar posición al canvas

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


                // Actualizar a todos

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


                // Eliminar jugador

                sala.delete(
                    socket.id
                );


                // Vacía

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

                    // Avisar a los restantes

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
