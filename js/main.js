(function()
{

    function toRad(degree)
    {
        return degree * Math.PI / 180 ;
    };

    var GAME_FPS = 60;

    var SCREEN_WIDTH = 800;
    var SCREEN_HEIGHT = 480;
    var ARM_LENGTH;//画像からロード
    var ARM_HEIGHT;//画像からロード

    var BOARD_X = 750;
    var BOARD_TOP = 50;

    var SHOULDER_ANGLE_FIRST = 80;
    var ELBOW_ANGLE_FIRST = -10;

    var SHOULDER_POS_X = 70;
    var SHOULDER_POS_Y = 260;

    //フォーム調整用    
    var TIME_RATE = 1;   //全体の速度はここで調整
    var SETTING_SHOULDER_ANG_VEL = -1.3 * TIME_RATE;
    var BENDING_ELBOW_ANG_VEL = -3 * TIME_RATE;
    var THROWING_SHOULDER_ANG_VEL = -2 * TIME_RATE;
    var THROWING_ELBOW_ANG_VEL = 10 * TIME_RATE;

    var ELBOW_ANGLE_MAX = 175;


    var VELOCITY_FIRST = 14;
    var GRAVITY = 0.2;

    //Armクラス-----------------------

    var State = {Set:0, RaisingArm:1, BendingElbow:2, Throwing:3, Finished:4, Max:5};

    Arm = function(shootDartFunc)
    {
        this.initialize(shootDartFunc);
        this.init();
    };

    Arm.prototype.handPos = function()
    {
        var xPos = this.shoulderPos.x + ARM_LENGTH * Math.cos(toRad(this.upperArm.angle)) + ARM_LENGTH * Math.cos(toRad(this.foreArm.angle));
        var yPos = this.shoulderPos.y + ARM_LENGTH * Math.sin(toRad(this.upperArm.angle)) + ARM_LENGTH * Math.sin(toRad(this.foreArm.angle));
        return {x: xPos, y: yPos};
    };

    Arm.prototype.dartsAngle = function()
    {
        return toRad((this.foreArm.angle + 90));
    };

    Arm.prototype.ToNextState = function()
    {
        //TODO Stateパターン
        switch(this.state)
        {
            // case State.RaiseArm:
            // break;

            case State.BendingElbow:
                var hand = this.handPos();
                var v0 = VELOCITY_FIRST;
                if(this.elbowAngle <= - ELBOW_ANGLE_MAX)
                {
                    v0 /= 2;
                }

                this.throwDart(hand.x, hand.y, this.dartsAngle(), v0);//TODO:角度
                this.nextState();
            // case State.Throw:
            // break;

            // case State.Finished:
            // break;
            case State.Throwing:
                //Do Nothing
                break;
            case State.Finished:
                this.nextState();
                dartShooter.RemoveGarbageDarts();
                break;

            default:
                this.nextState();
                break;
        }
    };

    Arm.prototype.Update = function()
    {
        this.refreshRelativeAngles();
        this.refreshArmAngles();
        this.refreshImage();
    };

    Arm.prototype.refreshRelativeAngles = function()
    {
        //TODO Stateパターン
        switch(this.state)
        {
            case State.Set:
                this.init();
                break;
            case State.RaisingArm:
                this.shoulderAngle += SETTING_SHOULDER_ANG_VEL;
                break;

            case State.BendingElbow:
                this.elbowAngle += BENDING_ELBOW_ANG_VEL;
                if(this.elbowAngle  < -ELBOW_ANGLE_MAX)
                {
                    this.elbowAngle = - ELBOW_ANGLE_MAX;
                }
                break;

            case State.Throwing:
                this.shoulderAngle += THROWING_SHOULDER_ANG_VEL;
                this.elbowAngle += THROWING_ELBOW_ANG_VEL;

                if(this.elbowAngle >= 0)
                {
                    this.state++;
                    this.elbowAngle = 0;
                }
                break;

            case State.Finished:
                break;

            default:
                break;
        }

    };

    Arm.prototype.refreshArmAngles = function()
    {
        this.upperArm.angle = this.shoulderAngle;
        this.foreArm.angle = this.upperArm.angle + this.elbowAngle;
    };

    Arm.prototype.initialize = function(shootFunc)
    {
        this.throwDart = shootFunc;
        this.upperArm = game.add.image(0, 0, 'upperArm');
        this.foreArm = game.add.image(0, 0, 'foreArm');
        ARM_LENGTH = this.upperArm.width;
        ARM_HEIGHT = this.upperArm.height;

        //関節
        this.shoulderJoint = game.add.image(0, 0, 'joint');
        this.shoulderJoint.anchor = new Phaser.Point(0.5, 0.5);

        this.elbowJoint = game.add.image(0, 0, 'joint');
        this.elbowJoint.anchor = new Phaser.Point(0.5, 0.5);
        
        this.handJoint = game.add.image(0, 0, 'joint');
        this.handJoint.anchor = new Phaser.Point(0.5, 0.5);

        //回転軸の指定
        this.upperArm.anchor = new Phaser.Point(0, 0.5);
        this.foreArm.anchor = new Phaser.Point(0, 0.5);
    };

    Arm.prototype.init = function()
    {
        this.shoulderAngle = SHOULDER_ANGLE_FIRST;
        this.elbowAngle = ELBOW_ANGLE_FIRST;
        this.state = State.Set;
        this.shoulderPos = new Phaser.Point(SHOULDER_POS_X, SHOULDER_POS_Y);
        this.shoulderJoint.position = this.shoulderPos;
    };

    Arm.prototype.refreshImage = function()
    {
        this.upperArm.position = new Phaser.Point(
            this.shoulderPos.x, this.shoulderPos.y);

        this.foreArm.position = new Phaser.Point(
            this.shoulderPos.x + ARM_LENGTH * Math.cos(toRad(this.upperArm.angle)),
            this.shoulderPos.y + ARM_LENGTH * Math.sin(toRad(this.upperArm.angle)));

        this.elbowJoint.position = this.foreArm.position;

        var handPos = this.handPos();
        this.handJoint.position = new Phaser.Point(handPos.x, handPos.y);

        //肩は更新しない
    };

    Arm.prototype.nextState = function()
    {
        this.state++;
        this.state = this.state % State.Max;
    };

    //-Armここまで----------------------------
    //Dart
    Dart = function(x0, y0, angle0, v0)
    {
        this.isFreezed = false;
        this.IsOutOfScreen = false;

        //TODO:初速は外からもらうべき？仮実装
        this.vx = v0 * Math.cos(angle0);
        this.vy = v0 * Math.sin(angle0);

        //x, yはダーツの中心を指す。画像の描画位置とは別。
        //positionで管理すると整数に丸められる可能性もあるため、別に管理する
        this.x = x0;
        this.y = y0;

        this.angle = angle0;
        this.image = game.add.image(0, 0, 'dartImg');
        this.refreshImagePosition();
    };

    Dart.prototype.Destory = function()
    {
        this.image.kill();
    };

    Dart.prototype.refreshImagePosition = function()
    {
        this.image.position.x = this.x - this.image.width / 2;
        this.image.position.y = this.y - this.image.height / 2;
    };

    Dart.prototype.checkOutOfScreen = function()
    {
        var MARGIN = 50;
        if (this.x < -MARGIN) return true;
        if (this.x > SCREEN_WIDTH + MARGIN) return true;
        if (this.y > SCREEN_HEIGHT + MARGIN) return true;
        return false;
    }
    Dart.prototype.Update = function()
    {
        if(this.isFreezed || this.IsOutOfScreen)
        {
            return;
        }

        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        var pointEdge = {x: this.x + this.image.width / 2, y: this.y};

        if(dartsBoard.hits(pointEdge.x, pointEdge.y))
        {
            this.x = BOARD_X - this.image.width / 2;
            this.isFreezed = true;
            if(dartsBoard.hitsBull(pointEdge.y))
            {
                game.camera.flash(0xffff00, 200);
                scorer.HitsBull();
                bullSound.play();                
            }
            else
            {
                scorer.Miss();
                missShotSound.play();
            }
        }
        this.refreshImagePosition();

        if(this.checkOutOfScreen())
        {
            this.IsOutOfScreen = true;
            scorer.Miss();
        }
    };

    //DartShooter----------------------------
    var DARTS_NUM_MAX_IN_SCREEN = 50;
    //TODO:名前。Factory的に作ったが・・・管理もしてるし・・・
    DartShooter = function()
    {
        this.dartsList = new Array();
    };

    DartShooter.prototype.Shoot = function(x, y, angle, v0)
    {
        //TODO:おためし中
        this.dartsList.push(new Dart(x, y, angle, v0));        
    };

    DartShooter.prototype.RemoveGarbageDarts = function()
    {
        var lastDartIdx = this.dartsList.length - 1;
        for(var i = lastDartIdx; i >= 0; i--)
        {
            if(this.dartsList[i].IsOutOfScreen)
            {
                this.dartsList[i].Destory();
                this.dartsList.splice(i, 1);//削除
            }
        }

        if(this.dartsList.length > DARTS_NUM_MAX_IN_SCREEN)
        {
            //一個スローするたびに呼ばれるので、１個削除すれば十分
            this.dartsList[0].Destory();
            this.dartsList.shift();//先頭を削除
        }
    }

    DartShooter.prototype.UpdateAllDart = function()
    {
        for(var i = 0; i < this.dartsList.length; i++)
        {
            this.dartsList[i].Update();
        }
    };

    DartShooter.prototype.RemoveAllDart = function()
    {
         for(var i = this.dartsList.length - 1; i >= 0; i--)
        {
            this.dartsList[i].Destory();
            this.dartsList.splice(i, 1);//削除
        }
    };

    //----DartsBoard------------------------
    var BOARD_BOTTOM;
    var BOARD_RIGHT;

    DartsBoard = function()
    {
        this.boardBaseImg = game.add.image(BOARD_X, BOARD_TOP, 'boardBase');

        this.bullImg = game.add.image(0, 0, 'bull');
        this.doubleBullImg = game.add.image(0, 0, 'doubleBull');

        this.bullImg.position.x = BOARD_X;
        this.bullImg.position.y = this.boardBaseImg.y + this.boardBaseImg.height / 2 - this.bullImg.height / 2;

        this.doubleBullImg.position.x = BOARD_X;
        this.doubleBullImg.position.y = this.bullImg.position.y + this.bullImg.height/2 - this.doubleBullImg.height/2;

        BOARD_BOTTOM = BOARD_TOP + this.boardBaseImg.height;
        BOARD_RIGHT = BOARD_X + this.boardBaseImg.width;
    };

    DartsBoard.prototype.hits = function(dartEdgeX, dartEdgeY)
    {
        //ダーツのポイントがBoardの中に入っていたらTrue
        if(dartEdgeX < BOARD_X) return false;
        if(dartEdgeY < BOARD_TOP) return false;
        if(dartEdgeY > BOARD_BOTTOM) return false;
        if(dartEdgeX > BOARD_RIGHT) return false;

        return true;
    }

    DartsBoard.prototype.hitsBull = function(dartEdgeY)
    {
        //TODO:BoardにHitした前提。改善する？
        if(dartEdgeY < this.bullImg.position.y) return false;
        if(dartEdgeY > this.bullImg.position.y + this.bullImg.height) return false;
        return true;
    }

    //---scorer--------
    Scorer = function()
    {
        this.scoreBest = 0;
        this.scoreOfContinuousBull = 0;

        this.scorerComponentList = new Array();

        var MARGIN_FROM_CORNER = 20;
        this.bullImg = game.add.image(MARGIN_FROM_CORNER, MARGIN_FROM_CORNER, 'bullCenter');
        this.bullImg.scale.setTo(0.5, 0.5);
        this.scorerComponentList.push(this.bullImg);

        var style = { font: "bold 32px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };

        this.scoreCurrentText = game.add.text(this.bullImg.width + 50, this.bullImg.position.y, "", style);
        this.scorerComponentList.push(this.scoreCurrentText);

        this.refresh();

        //最初は非表示
        hideAll(this.scorerComponentList);
    };

    Scorer.prototype.HitsBull = function()
    {
        this.scoreOfContinuousBull++;
        if(this.scoreOfContinuousBull > this.scoreBest)
        {
            this.scoreBest = this.scoreOfContinuousBull;
        }
        this.refresh();
    };

    Scorer.prototype.Miss = function()
    {
        this.HideScore();
        resultMenu.Show(this.scoreOfContinuousBull);
        gameState = GameState.ShowingResult;
        this.scoreOfContinuousBull = 0;
        this.refresh();
    };

    Scorer.prototype.refresh = function()
    {
        this.scoreCurrentText.text = 'x '+this.scoreOfContinuousBull;
    };

    Scorer.prototype.ShowScore = function()
    {
        showAll(this.scorerComponentList);
    };

    Scorer.prototype.HideScore = function()
    {
        hideAll(this.scorerComponentList);
    };

    //---------------------------------
    TitleMenu = function()
    {
        var titleStyle = { font: "bold 72px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };

        this.titleText = game.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, "2D Darts Game", titleStyle);
        this.titleText.anchor = new Phaser.Point(0.5, 0.5);

        //TODO:PCはClick to Start?
        var tapToStartStyle = { font: "bold 32px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };
        this.tapToStartText = game.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT * 3 / 4, "Tap to start", tapToStartStyle);
        this.tapToStartText.anchor = new Phaser.Point(0.5, 0.5);

        this.tapToStartText.alpha = 0.3;
        game.add.tween(this.tapToStartText).to( { alpha: 1 }, 500, Phaser.Easing.Linear.None, true, 0, 500, true);

        // this.titleText.position.x = SCREEN_WIDTH / 2 - this.title
        //this.backGround = new Phaser.Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    };

    TitleMenu.prototype.Hide = function()
    {
        this.titleText.visible = false;
        this.tapToStartText.visible = false;
    };

    // TitleMenu.prototype.Show = function()
    // {
        //game.debug.geom(titleMenu.backGround, '#000000');

    // };


    function tweetscore(){        
        //share score on twitter        
        var tweetbegin = 'http://twitter.com/home?status=';
        var tweettxt = 'I scored '+ 100 +' at this game -' + window.location.href + '.';
        var finaltweet = tweetbegin +encodeURIComponent(tweettxt);
        window.open(finaltweet,'_blank');
        // window.location = "https://twitter.com/intent/tweet";
    }

    function hideAll(componentList)
    {
        setVisible(componentList, false);
    }

    function showAll(componentList)
    {
        setVisible(componentList, true);
    }

    function setVisible(componentList, isVisible)
    {
        for(var i = 0; i < componentList.length; i++)
        {
            componentList[i].visible = isVisible;
        }
    }

    //----ResultMenu-------------------------
    ResultMenu = function()
    {
        this.resultMenuComponentList = new Array();

        this.backGroundImg = game.add.image(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 'resultBackGround');
        this.resultMenuComponentList.push(this.backGroundImg);

        var smallStyle = { font: "bold 32px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };
        var normalStyle = { font: "bold 48px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };
        var bigStyle = { font: "bold 64px Arial", fill: "#fff", boundsAlignH: "right", boundsAlignV: "middle" };
        this.yourScoreText = game.add.text(this.backGroundImg.x, 0, "Your score", normalStyle);
        this.yourScoreText.position.y = this.backGroundImg.y - this.backGroundImg.height/2 + this.yourScoreText.height;
        this.resultMenuComponentList.push(this.yourScoreText);

        this.bullImg = game.add.image(this.backGroundImg.x - this.backGroundImg.width / 5, this.backGroundImg.y, 'bullCenter');
        this.resultMenuComponentList.push(this.bullImg);

        this.scoreText = game.add.text(this.backGroundImg.x + 50, this.bullImg.y, "", bigStyle);
        this.resultMenuComponentList.push(this.scoreText);

        this.retryText = game.add.text(this.backGroundImg.x, 0, "Tap to retry", smallStyle);
        this.retryText.position.y = this.backGroundImg.y + this.backGroundImg.height / 2 - this.retryText.height,
        this.resultMenuComponentList.push(this.retryText);

        for(var i = 0; i < this.resultMenuComponentList.length; i++)
        {
            this.resultMenuComponentList[i].anchor = new Phaser.Point(0.5, 0.5);
        }
        this.Hide();
    };


    ResultMenu.prototype.Show = function(scoreResult)
    {
        this.scoreText.text = 'x ' + scoreResult;
        showAll(this.resultMenuComponentList);
    };

    ResultMenu.prototype.Hide = function()
    {
        hideAll(this.resultMenuComponentList);
    };

    //----main-------------------------
    var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, '', { preload: preload, create: create, update: update});
    var titleMenu;
    var arm;
    var dartShooter;
    var dartsBoard;
    var scorer;
    var bullSound;
    var missShotSound;
    var resultMenu;

    function preload() {
        game.load.image('foreArm', 'assets/armFig.png');
        game.load.image('upperArm', 'assets/armFig.png');
        game.load.image('dartImg', 'assets/dartImg.png');
        game.load.image('boardBase', 'assets/board.png');
        game.load.image('bull', 'assets/bull.png');
        game.load.image('doubleBull', 'assets/doubleBull.png');
        game.load.image('resultBackGround', 'assets/resultBackGround.png');
        game.load.image('bullCenter', 'assets/bullCenter.png');
        game.load.image('joint', 'assets/joint.png');

        game.load.audio('bullSound', 'assets/bullSound.wav');
        game.load.audio('missShotSound', 'assets/missShotSound.wav');

        game.time.desiredFps = GAME_FPS;

        //解像度対応処理.以下を参考にした
        //http://www.html5gamedevs.com/topic/5949-solution-scaling-for-multiple-devicesresolution-and-screens/
        if (this.game.device.desktop)
        {            
            this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
            this.scale.minWidth = SCREEN_WIDTH/2;
            this.scale.minHeight = SCREEN_HEIGHT/2;
            this.scale.maxWidth = SCREEN_WIDTH;
            this.scale.maxHeight = SCREEN_HEIGHT;
            this.scale.pageAlignHorizontally = true;
            this.scale.pageAlignVertically = true;
            //this.scale.setScreenSize(true);//deprecated.//TODO代わりにrefreshを呼ぶ?
       }        
       else
       {            
            this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
            this.scale.minWidth = SCREEN_WIDTH/2;
            this.scale.minHeight = SCREEN_HEIGHT/2;
            this.scale.maxWidth = 2048; 
            //You can change this to SCREEN_WIDTH;*2.5 if needed            
            this.scale.maxHeight = 1228; 

            //Make sure these values are proportional to the SCREEN_WIDTH; and SCREEN_HEIGHT            
            this.scale.pageAlignHorizontally = true;
            this.scale.pageAlignVertically = true;

            //違う方向のときに、コールバックを呼んだりしたいときはこの辺を使う
            // this.scale.forceOrientation(true, false);//有効にすると、フルスクリーンでフィットするのでコメントアウト
            // this.scale.hasResized.add(this.gameResized, this);
            // this.scale.enterIncorrectOrientation.add(this.enterIncorrectOrientation, this);
            // this.scale.leaveIncorrectOrientation.add(this.leaveIncorrectOrientation, this);
            // //this.scale.setScreenSize(true);//deprecated.//TODO代わりにrefreshを呼ぶ?
        }
    }

    function create() {
        game.stage.backgroundColor = "000000";
        dartShooter = new DartShooter();
        arm = new Arm(dartShooter.Shoot.bind(dartShooter));
        dartsBoard = new DartsBoard();
        scorer = new Scorer();
        bullSound = this.add.audio('bullSound');
        missShotSound = this.add.audio('missShotSound');
        titleMenu = new TitleMenu();
        resultMenu = new ResultMenu();

    }

    var isClickOn = false;
    var isClickOnPrev = false;
    function isClickOnEdge()
    {
        var isOnEdge = false;
        //TODO:クリックどうやるんだ
        if (game.input.activePointer.isDown)
        {
            isClickOn = true;
        }

        if (game.input.activePointer.isUp)
        {
            isClickOn = false;
        }

        //OnEdgeをとる
        if(isClickOn && !isClickOnPrev)
        {
            isOnEdge = true;
        }

        isClickOnPrev = isClickOn;
        return isOnEdge;
    }

    // function render()
    // {
    //     titleMenu.Show();
    // }

    var GameState = {Title:0, Playing: 1, ShowingResult: 2};
    var gameState = GameState.Title;

    function dispatchEvent()
    {
        if(isClickOnEdge())
        {
            switch (gameState)
            {
                case GameState.Title:
                    titleMenu.Hide();   
                    scorer.ShowScore();
                    gameState = GameState.Playing;
                    //tweetscore();                 
                    break;
                case GameState.Playing:
                    arm.ToNextState();
                    break;
                case GameState.ShowingResult:
                    resultMenu.Hide();
                    gameState = GameState.Playing;
                    scorer.ShowScore();
                    dartShooter.RemoveAllDart();
                    arm.ToNextState();//TODO:Armの状態をFinish→Setに一回クリックするのが嫌なのでここで呼んでいる。きれいにしたい。
                    break;
            }
        }
    }

    function update() {
        arm.Update();
        dartShooter.UpdateAllDart();
        dispatchEvent();
    }

})();