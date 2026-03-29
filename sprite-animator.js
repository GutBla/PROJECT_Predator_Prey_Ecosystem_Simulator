class SpriteAnimator {
    constructor(frames, frameDuration = 100) {
        this.frames = frames;
        this.frameDuration = frameDuration;
        this.currentFrame = 0;
        this.elapsedTime = 0;
    }

    update(deltaTime) {
        if (!this.frames.length) return;
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.frameDuration) {
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            this.elapsedTime -= this.frameDuration;
        }
    }

    getCurrentFrame() {
        return this.frames[this.currentFrame];
    }
}