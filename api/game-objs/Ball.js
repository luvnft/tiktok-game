const { v4: uuidv4 } = require('uuid')

module.exports = class Ball {
    constructor(size, speed, color) {
        this.id = uuidv4()
        this.size = size
        this.speed = speed

        this.moveX = speed
        this.moveY = speed
        this.color = color
        this.status = true

        this.level = 1
    }

    registerUser(userId, imgUrl) {
        this.userId = userId
        this.imgUrl = imgUrl
    }

    addSpeed(speed) {
        this.speed += speed
        this.moveX += speed
        this.moveY += speed
    }
}