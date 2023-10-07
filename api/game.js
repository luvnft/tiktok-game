require('dotenv').config()

const { io, logger } = require('../app')
const Util = require('./utils/Util')
const { WebcastPushConnection } = require('tiktok-live-connector')

const Ball = require('./game-objs/Ball')
const Wall = require('./game-objs/Wall')

//Env
const LIVE_NAME = process.env.LIVE_NAME
const WALL_BACKGROUND = process.env.WALL_BACKGROUND
const WALL_SIZE = parseInt(process.env.WALL_SIZE)
const WALL_ROW = parseInt(process.env.WALL_ROW)
const WALL_COL = parseInt(process.env.WALL_COL)
const BALL_SIZE = parseInt(process.env.BALL_SIZE)
const BALL_SPEED = parseInt(process.env.BALL_SPEED)
const BALL_MAX_SIZE = parseInt(process.env.BALL_MAX_SIZE)
const WALL_BLOCKS_MIN = 4

//Build Wall
const wall = new Wall(WALL_SIZE, 2, WALL_COL, WALL_ROW, WALL_BACKGROUND)
let balls = []

//Respawn Blocks
setInterval(() => {
    balls = balls.filter((b) => b.status === true)
    const min = WALL_BLOCKS_MIN

    let arr = []
    wall.getBlocks((block) => {
        if (!block.status) arr.push(block)

    }, () => {
        if (arr.length === 0 || arr.length <= min) return

        let count = 0
        while (count < arr.length) {
            const obj = arr[Math.floor(Math.random() * arr.length)]

            if (obj) {
                wall.getBlocks((block) => {
                    if (block.id === obj.id) {
                        block.reset()
                        return true
                    }
                })
            }

            count++
        }

        emitStateStartGlobal(2, wall)
    })
}, 5000)

//Enable Server Socket
io.on('connection', (socket) => {
    const clientAddress = socket.handshake.address;
    const clientID = socket.id;

    logger.info(`Client connected - ID: ${clientID}, Address: ${clientAddress}`)

    //Latency
    socket.on('ping', () => {
        socket.emit('pong')
    })

    emitStartState(socket, 2, wall)
    emitStartState(socket, 1, balls)

    socket.on('update-state', obj => {
        switch (obj.type) {
            case 1:
                const block = obj.data
                if (block) {
                    wall.replaceBlock(block)
                    emitUpdateState(socket, 2, block)
                }
                break

            case 2:
                const ball = obj.data
                if (ball) {
                    for (let b of balls) {
                        if (b.id === ball.id) {
                            b.status = ball.status
                            b.size = ball.size
                            b.level = ball.level
                            emitUpdateState(socket, 1, b)
                            break
                        }
                    }
                }
                break
        }
    })
})

//Connect to live
const tkCon = new WebcastPushConnection(LIVE_NAME, {
    enableExtendedGiftInfo : true
})

tkCon.connect().then(state => {
    logger.info('Live successful connected! @'+LIVE_NAME)

    //Live Listeners
    tkCon.on('chat', p => {
        setBlockImagePixel(p.userId, p.profilePictureUrl, p.comment)
        logger.info(`[Live-Chat @${p.nickname}] ${p.comment}`)
    });
    tkCon.on('gift', msg => {
        let found = false
        for (let ball of balls) {
            if (ball.userId === msg.userId)    {
                ball.addSize(msg.repeatCount <= 0 ? 1 : msg.repeatCount / 2)
                found = true
                emitStateGlobal(1, ball)
                break
            }
        }

        if (!found) spawnRandomBall(msg.userId, msg.profilePictureUrl)
        logger.info(`[Live-Gift ${msg.nickname}] Show de Bola!! Uma lenda contribuiu para Live! ID: ${msg.giftId} Repeat ${msg.repeatCount}`)
    });
    tkCon.on('like', msg => {
        for (let ball of balls) {
            if (ball.userId === msg.userId)    {
                ball.addSpeed(msg.likeCount <= 0 ? 1 : msg.likeCount / 2)
                emitStateGlobal(1, ball)
                break
            }
        }
        logger.info(`[Live-Like ${msg.nickname}] Curtiu a live x${msg.likeCount}`)
    });

    //con.on('social', msg => socket.emit('social', msg));
    //con.on('like', msg => socket.emit('like', msg));
    //con.on('questionNew', msg => socket.emit('questionNew', msg));
    //con.on('linkMicBattle', msg => socket.emit('linkMicBattle', msg));
    //con.on('linkMicArmies', msg => socket.emit('linkMicArmies', msg));
    //con.on('liveIntro', msg => socket.emit('liveIntro', msg));
    //con.on('emote', msg => socket.emit('emote', msg));
    //con.on('envelope', msg => socket.emit('envelope', msg));
    //con.on('subscribe', msg => socket.emit('subscribe', msg));


}).catch(err => {
    logger.error('Erro to connected in live @'+LIVE_NAME, err.toString())
    Object.keys(io.sockets.sockets).forEach(function(s) {
        io.sockets.sockets[s].disconnect(true);
    })
}) 

// Game

function spawnRandomBall(userId, imgUrl) {    
    const ball = new Ball(BALL_SIZE, BALL_MAX_SIZE, BALL_SPEED, Util.getRandomRGB())
    ball.registerUser(userId, imgUrl)
    balls.push(ball)

    emitStateGlobal(1, ball)
}

function setBlockImagePixel(userId, imgUrl, comment) {
    wall.getBlocks((block) => {
        if (block.status && block.isNotUser()) {
            block.registerUser(userId, imgUrl)
            block.setMsg(comment)
            emitStateGlobal(2, block)
            return true
        }
    })
}

//Emitter
function emitStateStartGlobal(type, data) {
    io.sockets.emit('game-state-start', { type : type, data : data })
}

function emitStateGlobal(type, data) {
    io.sockets.emit('game-state-update', { type : type, data : data })
}

function emitStartState(socket, type, data) {
    socket.emit('game-state-start', { type : type, data : data })
}

function emitUpdateState(socket, type, data) {
    socket.emit('game-state-update', { type : type, data : data })
}