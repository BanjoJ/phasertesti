var config = {
    type: Phaser.AUTO,
    parent: 'content',
    width: 640,
    height: 512,
    physics: {
        default: 'arcade'
    },
    scene: {
        key: 'main',
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

var credits = 100;
var pointsText;
var level = 1;

var sellKey;
var selectedTurret;


var path;
var turrets;
var enemies;

var ENEMY_SPEED = 1 / 10000;
var ENEMY_HP = 100;
var ENEMY_DAMAGE_INCREASE = 25;


var BULLET_DAMAGE = 50;

var map = [[0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
[0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
[0, -1, -1, -1, -1, -1, -1, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0]];

function preload() {
    this.load.atlas('sprites', 'assets/spritesheet.png', 'assets/spritesheet.json');
    this.load.image('bullet', 'assets/bullet.png');
}

var Enemy = new Phaser.Class({

    Extends: Phaser.GameObjects.Image,

    initialize:

        function Enemy(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'sprites', 'enemy');

            this.follower = { t: 0, vec: new Phaser.Math.Vector2() };
            this.hp = 0;
        },

    startOnPath: function () {
        this.follower.t = 0;
        this.hp = ENEMY_HP + (level - 1) * ENEMY_DAMAGE_INCREASE;

        path.getPoint(this.follower.t, this.follower.vec);

        this.setPosition(this.follower.vec.x, this.follower.vec.y);
    },
    receiveDamage: function (damage) {
        this.hp -= damage;

        // if hp drops below 0 we deactivate this enemy
        if (this.hp <= 0) {
            this.setActive(false);
            this.setVisible(false);
            credits += 5; // add 5 credits when enemy is destroyed
            pointsText.setText('Points: ' + credits);
        }
    },
    update: function (time, delta) {
        this.follower.t += ENEMY_SPEED * delta;
        path.getPoint(this.follower.t, this.follower.vec);

        this.setPosition(this.follower.vec.x, this.follower.vec.y);

        if (time > this.nextEnemy) {
            var enemy = enemies.get();
            if (enemy) {
                enemy.setActive(true);
                enemy.setVisible(true);
                enemy.startOnPath();

                this.nextEnemy = time + 2000;
            }
        }

        if (this.follower.t >= 1) {
            this.setActive(false);
            this.setVisible(false);
        }
    }

});

function getEnemy(x, y, distance) {
    var enemyUnits = enemies.getChildren();
    for (var i = 0; i < enemyUnits.length; i++) {
        if (enemyUnits[i].active && Phaser.Math.Distance.Between(x, y, enemyUnits[i].x, enemyUnits[i].y) < distance)
            return enemyUnits[i];
    }
    return false;
}

var Turret = new Phaser.Class({

    Extends: Phaser.GameObjects.Image,

    initialize:

        function Turret(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'sprites', 'turret');
            this.nextTic = 0;
            this.i = 0;
            this.j = 0;
        },
    place: function (i, j) {
        if (credits > 9 && map[i][j] !== -1 && map[i][j] !== 1) {
            if (this.i !== 0 && this.j !== 0) {
                map[this.i][this.j] = 0;
            }
            this.y = i * 64 + 64 / 2;
            this.x = j * 64 + 64 / 2;
            map[i][j] = 1;
            this.i = i;
            this.j = j;
            credits -= 10;
        }
        else {
            this.y = -100;
            this.x = -100;
        }
    },
    fire: function () {
        var enemy = getEnemy(this.x, this.y, 200);
        if (enemy) {
            var angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
            addBullet(this.x, this.y, angle);
            this.angle = (angle + Math.PI / 2) * Phaser.Math.RAD_TO_DEG;
        }
    },
    update: function (time, delta) {
        if (time > this.nextTic) {
            this.fire();
            this.nextTic = time + 1000;
        }
    }
});
var Bullet = new Phaser.Class({

    Extends: Phaser.GameObjects.Image,

    initialize:

        function Bullet(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'bullet');

            this.incX = 0;
            this.incY = 0;
            this.lifespan = 0;

            this.speed = Phaser.Math.GetSpeed(600, 1);
        },

    fire: function (x, y, angle) {
        this.setActive(true);
        this.setVisible(true);
        //  Bullets fire from the middle of the screen to the given x/y
        this.setPosition(x, y);

        //  we don't need to rotate the bullets as they are round
        //    this.setRotation(angle);

        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);

        this.lifespan = 1000;
    },

    update: function (time, delta) {
        this.lifespan -= delta;

        this.x += this.dx * (this.speed * delta);
        this.y += this.dy * (this.speed * delta);

        if (this.lifespan <= 0) {
            this.setActive(false);
            this.setVisible(false);
        }
    }

});

function damageEnemy(enemy, bullet) {
    // only if both enemy and bullet are alive
    if (enemy.active === true && bullet.active === true) {
        // we remove the bullet right away
        bullet.setActive(false);
        bullet.setVisible(false);

        // decrease the enemy hp with BULLET_DAMAGE
        enemy.receiveDamage(BULLET_DAMAGE);
    }
}

function drawLines(graphics) {
    graphics.lineStyle(1, 0x0000ff, 0.8);
    for (var i = 0; i < 8; i++) {
        graphics.moveTo(0, i * 64);
        graphics.lineTo(640, i * 64);
    }
    for (var j = 0; j < 10; j++) {
        graphics.moveTo(j * 64, 0);
        graphics.lineTo(j * 64, 512);
    }
    graphics.strokePath();
}

function update(time, delta) {

    if (time > this.nextEnemy) {
        var enemy = enemies.get();
        if (enemy) {
            enemy.setActive(true);
            enemy.setVisible(true);
            enemy.startOnPath();

            this.nextEnemy = time + 2000;
        }
    }
}

function canPlaceTurret(i, j) {
    return map[i][j] === 0;
}

function placeTurret(pointer) {
    var i = Math.floor(pointer.y / 64);
    var j = Math.floor(pointer.x / 64);
    if (canPlaceTurret(i, j)) {
        var turret = turrets.get();
        if (turret) {
            turret.setActive(true);
            turret.setVisible(true);
            turret.place(i, j);
            pointsText.setText('Points: ' + credits);
        }
    }
}

function addBullet(x, y, angle) {
    var bullet = bullets.get();
    if (bullet) {
        bullet.fire(x, y, angle);
    }
}

function increaseDifficulty() {
    ENEMY_SPEED += 0.0001; // Increase enemy speed
    BULLET_DAMAGE += 10; // Increase bullet damage
    ENEMY_HP += ENEMY_DAMAGE_INCREASE; // Increase enemy HP for the next level
    level++; // Increment level
}

function create() {
    var graphics = this.add.graphics();
    drawLines(graphics);
    path = this.add.path(96, -32);
    path.lineTo(96, 164);
    path.lineTo(480, 164);
    path.lineTo(480, 544);

    graphics.lineStyle(2, 0xffffff, 1);
    path.draw(graphics);

    enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });

    turrets = this.add.group({ classType: Turret, runChildUpdate: true });

    bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });

    this.nextEnemy = 0;

    this.physics.add.overlap(enemies, bullets, damageEnemy);

    this.input.on('pointerdown', placeTurret);

    // Generate points text
    pointsText = this.add.text(10, 10, 'Points: ' + credits, { fontSize: '24px', fill: '#ffffff' });
    levelText = this.add.text(10, 40, 'Level: ' + level, { fontSize: '24px', fill: '#ffffff' }); // Display current level

    sellKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.input.on('pointerdown', handlePointerDown, this);

    increaseDifficulty();
}

function handlePointerDown(pointer) {
    if (sellKey.isDown) {
        // Check if the clicked position overlaps with a turret
        const clickedTurret = getClickedTurret(pointer.x, pointer.y);
        if (clickedTurret) {
            sellTurret(clickedTurret);
        }
    }
}

function getClickedTurret(x, y) {
    const turretArray = turrets.getChildren();
    for (let i = 0; i < turretArray.length; i++) {
        const turret = turretArray[i];
        if (turret.active && Phaser.Math.Distance.Between(x, y, turret.x, turret.y) < 32) {
            return turret;
        }
    }
    return null;
}

function sellTurret(turret) {
    const i = Math.floor(turret.y / 64);
    const j = Math.floor(turret.x / 64);

    if (map[i][j] === 1) {
        turret.setActive(false);
        turret.setVisible(false);
        map[i][j] = 0;

        // Add the sell value to the player's credits
        credits += 5; // Change the value as per your requirement
        pointsText.setText('Points: ' + credits);
    }
}