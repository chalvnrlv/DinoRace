(function() {
    'use strict';

    // Ini adalah kode inti dari game dinosaurus.
    // Kode multiplayer akan ditambahkan di akhir untuk memodifikasinya.

    function Runner(outerContainerId, opt_config) {
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.tRex = null;
        this.distanceMeter = null;
        this.distanceRan = 0;
        this.highestScore = 0;
        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / 60;
        this.currentSpeed = 6;
        this.obstacles = [];
        this.activated = false;
        this.playing = false;
        this.crashed = false;
        this.paused = false;
        this.inverted = false;
        this.invertTimer = 0;
        this.resizeTimerId_ = null;
        this.playCount = 0;
        this.soundFx = {};
        this.config = opt_config || Runner.config;
        this.dimensions = Runner.defaultDimensions;
        this.loadImages();
    }

    window['Runner'] = Runner;

    Runner.config = {
        SPEED: 6,
        GAP_COEFFICIENT: 0.6,
        MAX_CLOUDS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        RESOURCE_TEMPLATE_ID: 'resource-template'
    };

    Runner.defaultDimensions = {
        WIDTH: 600,
        HEIGHT: 150
    };

    Runner.classes = {
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        INVERTED: 'inverted',
        PLAYER: 't-rex'
    };

    Runner.spriteDefinition = {
        LDPI: {
            CACTUS_LARGE: {
                x: 332,
                y: 2
            },
            CACTUS_SMALL: {
                x: 228,
                y: 2
            },
            CLOUD: {
                x: 86,
                y: 2
            },
            HORIZON: {
                x: 2,
                y: 54
            },
            PTERODACTYL: {
                x: 134,
                y: 2
            },
            RESTART: {
                x: 2,
                y: 2
            },
            TEXT_SPRITE: {
                x: 655,
                y: 2
            },
            TREX: {
                x: 848,
                y: 2
            }
        }
    };

    Runner.keyCodes = {
        JUMP: {
            '38': 1,
            '32': 1
        }, // Up, spacebar
        DUCK: {
            '40': 1
        }, // Down
        RESTART: {
            '13': 1
        } // Enter
    };

    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load'
    };

    Runner.prototype = {
        loadImages: function() {
            this.spriteDef = Runner.spriteDefinition.LDPI;
            Runner.imageSprite = document.getElementById('offline-resources-1x');
            this.init();
        },

        init: function() {
            this.canvas = document.querySelector('.' + Runner.classes.CANVAS);
            this.canvas.width = this.dimensions.WIDTH;
            this.canvas.height = this.dimensions.HEIGHT;
            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();

            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions,
                this.config.GAP_COEFFICIENT);
            this.distanceMeter = new DistanceMeter(this.canvas, this.spriteDef.TEXT_SPRITE,
                this.dimensions.WIDTH);
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);
            this.startListening();
            this.update();
        },

        startListening: function() {
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);
        },

        handleEvent: function(e) {
            switch (e.type) {
                case Runner.events.KEYDOWN:
                    this.onKeyDown(e);
                    break;
                case Runner.events.KEYUP:
                    this.onKeyUp(e);
                    break;
            }
        },

        onKeyDown: function(e) {
            if (this.crashed) return;
            if (Runner.keyCodes.JUMP[e.keyCode]) {
                e.preventDefault();
                if (!this.playing) {
                    this.play();
                }
                if (!this.tRex.jumping && !this.tRex.ducking) {
                    this.tRex.startJump(this.currentSpeed);
                }
            } else if (this.playing && Runner.keyCodes.DUCK[e.keyCode]) {
                e.preventDefault();
                this.tRex.setDuck(true);
            }
        },

        onKeyUp: function(e) {
            if (this.playing && Runner.keyCodes.DUCK[e.keyCode]) {
                this.tRex.setDuck(false);
            }
        },


        update: function() {
            this.draw();
            if (this.playing) {
                this.tRex.update(this.msPerFrame);
                this.distanceRan += this.currentSpeed * this.msPerFrame / 1000;
                this.distanceMeter.update(this.distanceRan);

                this.horizon.update(this.msPerFrame, this.currentSpeed);

                var obstacles = this.horizon.obstacles;
                for (var i = 0; i < obstacles.length; i++) {
                    if (this.tRex.collidesWith(obstacles[i])) {
                        this.gameOver();
                        this.tRex.update(1000, Trex.status.CRASHED);
                        break;
                    }
                }
            }
            window.requestAnimationFrame(this.update.bind(this));
        },

        play: function() {
            if (!this.crashed) {
                this.playing = true;
                this.tRex.setJumpVelocity(0);
            }
        },
        
        playIntro: function() {
            this.play();
        },

        gameOver: function() {
            this.playing = false;
            this.crashed = true;
            this.distanceMeter.achievement = false;
            this.tRex.update(1000, Trex.status.CRASHED);
            if (this.distanceRan > this.highestScore) {
                this.highestScore = this.distanceRan;
                this.distanceMeter.setHighScore(this.highestScore);
            }
        },

        restart: function() {
            this.distanceRan = 0;
            this.playing = false;
            this.crashed = false;
            this.tRex.reset();
            this.horizon.reset();
            this.distanceMeter.reset(this.highestScore);
            this.play();
        },

        draw: function() {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
            this.horizon.draw(this.canvasCtx);
            this.tRex.draw(this.canvasCtx);
            this.distanceMeter.draw(this.canvasCtx);
        }
    };

    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.status = Trex.status.WAITING;
        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;

        this.init();
    }

    Trex.config = {
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: -10,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        WIDTH: 44,
        WIDTH_DUCK: 59,
        HEIGHT: 47
    };

    Trex.status = {
        CRASHED: 'CRASHED',
        DUCKING: 'DUCKING',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING'
    };

    Trex.prototype = {
        init: function() {
            this.groundYPos = Runner.defaultDimensions.HEIGHT - Trex.config.HEIGHT - 10;
            this.yPos = this.groundYPos;
            this.xPos = 10;
        },

        update: function(deltaTime, opt_status) {
            this.status = Trex.status.RUNNING;
            if (this.jumping) {
                this.updateJump(deltaTime);
            }
            this.draw(this.currentFrame);
        },

        updateJump: function(deltaTime) {
            var msPerFrame = 16;
            var framesElapsed = deltaTime / msPerFrame;
            this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            this.jumpVelocity += Trex.config.GRAVITY * framesElapsed;

            if (this.yPos < this.groundYPos - Trex.config.MAX_JUMP_HEIGHT) {
                this.yPos = this.groundYPos - Trex.config.MAX_JUMP_HEIGHT;
                this.jumpVelocity = 0;
            }

            if (this.yPos > this.groundYPos) {
                this.reset();
                this.jumpCount++;
            }
        },

        startJump: function(speed) {
            if (!this.jumping) {
                this.jumping = true;
                this.jumpVelocity = Trex.config.INITIAL_JUMP_VELOCITY - (speed / 10);
            }
        },

        reset: function() {
            this.yPos = this.groundYPos;
            this.jumpVelocity = 0;
            this.jumping = false;
            this.ducking = false;
            this.update(0, Trex.status.RUNNING);
            this.speedDrop = false;
            this.jumpCount = 0;
        },
        
        collidesWith: function(obstacle) {
            var tRexBox = new CollisionBox(
                this.xPos + 1,
                this.yPos + 1,
                Trex.config.WIDTH - 2,
                Trex.config.HEIGHT - 2);

            var obstacleBox = new CollisionBox(
                obstacle.xPos + 1,
                obstacle.yPos + 1,
                obstacle.typeConfig.width * obstacle.size - 2,
                obstacle.typeConfig.height - 2);
                
            return tRexBox.collidesWith(obstacleBox);
        },

        draw: function() {
            var sourceX = this.spritePos.x;
            var sourceY = this.spritePos.y;
            this.canvasCtx.drawImage(Runner.imageSprite, sourceX, sourceY, Trex.config.WIDTH, Trex.config.HEIGHT, this.xPos, this.yPos, Trex.config.WIDTH, Trex.config.HEIGHT);
        },
        
        setDuck: function(isDucking) {
            // Ducking logic simplified/removed for this example
        }
    };
    
    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    };
    
    CollisionBox.prototype.collidesWith = function(target) {
        return this.x < target.x + target.width &&
               this.x + this.width > target.x &&
               this.y < target.y + target.height &&
               this.height + this.y > target.y;
    }


    function DistanceMeter(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 5;
        this.maxScore = 0;
        this.achievement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;
        this.config = DistanceMeter.config;
        this.init(canvasWidth);
    };

    DistanceMeter.config = {
        // Configs...
    };

    DistanceMeter.prototype = {
        init: function(width) {
            this.x = width - (this.config.DESTINATION_WIDTH * 6);
        },
        update: function(distance) {
            // Logic to update score
        },
        setHighScore: function(distance) {
            // Logic to set high score
        },
        reset: function() {
            // Logic to reset score
        },
        draw: function(ctx) {
            // Logic to draw score - simplified
            ctx.font = '12px "Press Start 2P"';
            ctx.fillStyle = '#535353';
            ctx.fillText('HI ' + 0 + ' ' + 0, this.x, this.y + 12);
        }
    };

    function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonLine = null;
        this.init();
    }

    Horizon.prototype = {
        init: function() {
            this.addCloud();
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
        },
        update: function(deltaTime, currentSpeed) {
            this.horizonLine.update(deltaTime, currentSpeed);
            this.updateCloud(deltaTime, currentSpeed);
            this.updateObstacles(deltaTime, currentSpeed);
        },
        addCloud: function() {
            // Logic to add clouds
        },
        updateCloud: function() {
            // Logic to update clouds
        },
        updateObstacles: function(deltaTime, currentSpeed) {
            var updatedObstacles = this.obstacles.slice(0);
            for (var i = 0; i < this.obstacles.length; i++) {
                var obstacle = this.obstacles[i];
                obstacle.update(deltaTime, currentSpeed);
                if (obstacle.remove) {
                    updatedObstacles.splice(i, 1);
                }
            }
            this.obstacles = updatedObstacles;
            if (this.obstacles.length > 0) {
                var lastObstacle = this.obstacles[this.obstacles.length - 1];
                if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                    lastObstacle.isVisible() &&
                    (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) <
                    this.dimensions.WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {
                this.addNewObstacle(currentSpeed);
            }
        },
        addNewObstacle: function(currentSpeed) {
            var obstacleTypeIndex = Math.floor(Math.random() * Obstacle.types.length);
            var obstacleType = Obstacle.types[obstacleTypeIndex];
            this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType, this.spritePos, this.dimensions, 20, currentSpeed));
        },
        reset: function() {
            this.obstacles = [];
            this.horizonLine.reset();
        },
        draw: function(ctx) {
            this.horizonLine.draw(ctx);
            for (var i = 0; i < this.obstacles.length; i++) {
                this.obstacles[i].draw(ctx);
            }
        }
    };
    
    function HorizonLine(canvas, spritePos) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.sourceXPos = [this.spritePos.x, this.spritePos.x + 600];
        this.xPos = [0, 600];
        this.yPos = 127;
        this.bumpThreshold = 0.5;
        this.draw();
    }

    HorizonLine.prototype = {
        update: function(deltaTime, speed) {
            for (var i = 0; i < this.xPos.length; i++) {
                this.xPos[i] -= speed;
            }
            if (this.xPos[0] <= -600) {
                this.xPos[0] += 1200;
            }
        },
        draw: function() {
            // Logic to draw horizon
        },
        reset: function() {
            this.xPos[0] = 0;
            this.xPos[1] = 600;
        }
    }


    function Obstacle(ctx, type, spritePos, dimensions, gap, speed) {
        this.ctx = ctx;
        this.spritePos = spritePos;
        this.typeConfig = type;
        this.gap = gap;
        this.size = Math.floor(Math.random() * Obstacle.MAX_OBSTACLE_LENGTH) + 1;
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = dimensions.WIDTH;
        this.yPos = this.typeConfig.yPos;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = this.getRandomNum(Obstacle.MIN_GAP_COEFFICIENT, Obstacle.MAX_GAP_COEFFICIENT) * speed;
        this.init();
    }

    Obstacle.MAX_OBSTACLE_LENGTH = 3;
    Obstacle.MIN_GAP_COEFFICIENT = 1.5;
    Obstacle.MAX_GAP_COEFFICIENT = 2.5;

    Obstacle.types = [{
        type: 'CACTUS_SMALL',
        width: 17,
        height: 35,
        yPos: 105
    }, {
        type: 'CACTUS_LARGE',
        width: 25,
        height: 50,
        yPos: 90
    }];

    Obstacle.prototype = {
        init: function() {
            this.cloneCollisionBoxes();
            this.width = this.typeConfig.width * this.size;
        },
        update: function(deltaTime, speed) {
            this.xPos -= speed;
            if (this.xPos < -this.width) {
                this.remove = true;
            }
        },
        draw: function() {
            var sourceX = this.typeConfig.width * this.size;
            var sourceY = 0;
            // Draw logic for obstacles - simplified for brevity
        },
        cloneCollisionBoxes: function() {
            // Logic to setup collision boxes
        },
        getRandomNum: function(min, max) {
            return Math.floor(Math.random() * (max-min+1)) + min;
        },
        isVisible: function() {
            return this.xPos + this.width > 0;
        }
    };


    // =========================================================================================
    // MODIFIKASI UNTUK MULTIPLAYER DIMULAI DI SINI
    // =========================================================================================
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof Runner === 'undefined') {
            console.error('Runner object not found. Make sure this script is loaded after the main game script.');
            return;
        }

        let gameInstance = null;
        let gameStartedByServer = false;
        let myClientId = null;

        // ----- Elemen UI -----
        const connectionStatusElem = document.getElementById('connection-status');
        const playersListElem = document.getElementById('players-list');
        const readyButton = document.getElementById('ready-button');
        const opponentScoreElem = document.getElementById('opponent-score');

        // ----- Koneksi WebSocket -----
        const ws = new WebSocket('ws://172.16.16.101:6666');

        ws.onopen = () => {
            connectionStatusElem.textContent = 'Connected to Server!';
            connectionStatusElem.style.color = 'green';
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Message from server:', data);

            if (data.type === "PLAYER_UPDATE") {
                updatePlayersList(data.players);
            } else if (data.type === "START_GAME") {
                document.getElementById('multiplayer-status').style.display = 'none';
                gameStartedByServer = true;
                if (gameInstance) {
                    gameInstance.restart();
                }
            } else if (data.type === "SCORE_UPDATE") {
                // Tampilkan skor pemain lain
                if (data.id !== myClientId && opponentScoreElem) {
                    opponentScoreElem.innerText = 'OPPONENT: ' + Math.floor(data.score);
                }
            } else if (data.type === "ERROR") {
                alert("Server Error: " + data.message);
                connectionStatusElem.textContent = data.message;
                connectionStatusElem.style.color = 'red';
                readyButton.disabled = true;
            }
        };

        ws.onclose = () => {
            connectionStatusElem.textContent = 'Disconnected from Server!';
            connectionStatusElem.style.color = 'red';
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            connectionStatusElem.textContent = 'Connection Error!';
            connectionStatusElem.style.color = 'red';
        };
        
        // Dapatkan client ID setelah koneksi pertama berhasil
        ws.addEventListener('open', () => {
             // Cara sederhana untuk mendapatkan ID unik (meskipun tidak dijamin)
             // Server akan tahu dari alamat IP.
             myClientId = 'me'; 
        });


        function updatePlayersList(players) {
            playersListElem.innerHTML = ''; // Kosongkan daftar
            Object.keys(players).forEach(playerId => {
                const player = players[playerId];
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-status';

                let statusText = player.status || 'Connecting...';
                let statusClass = 'status-connected';
                if (player.status === 'READY') {
                    statusText = 'Ready';
                    statusClass = 'status-ready';
                }

                playerDiv.innerHTML = `Player (${playerId.slice(-5)}): <span class="${statusClass}">${statusText}</span>`;
                playersListElem.appendChild(playerDiv);
            });
        }
        
        // Kirim update skor secara periodik
        setInterval(() => {
            if (gameInstance && gameInstance.playing && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'UPDATE_SCORE',
                    score: gameInstance.distanceRan
                }));
            }
        }, 500);

        // ----- Modifikasi Logika Game -----
        const originalInit = Runner.prototype.init;
        const originalRestart = Runner.prototype.restart;
        const originalGameOver = Runner.prototype.gameOver;
        const originalPlay = Runner.prototype.play;


        Runner.prototype.init = function() {
            originalInit.apply(this, arguments);
            gameInstance = this;
            this.stop();
            console.log('Game initialized but paused, waiting for server signal.');
        };
        
        Runner.prototype.play = function() {
            if(gameStartedByServer) {
                originalPlay.apply(this, arguments);
            } else {
                 console.log("Cannot play manually. Click 'Ready' and wait.");
            }
        };

        Runner.prototype.restart = function() {
            if (gameStartedByServer) {
                originalRestart.apply(this, arguments);
            } else {
                console.log("Cannot restart game manually. Click 'Ready' and wait.");
            }
        };

        Runner.prototype.gameOver = function() {
            originalGameOver.apply(this, arguments);
            // Tambahkan logika jika perlu saat game over
        };

        // ----- Event Listener untuk Tombol Ready -----
        readyButton.addEventListener('click', () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'READY' }));
                readyButton.textContent = "Waiting for others...";
                readyButton.disabled = true;
            } else {
                alert('Not connected to the server yet!');
            }
        });

        // Inisialisasi game utama setelah semua modifikasi kita siap
        new Runner('.runner-container');
    });

})();