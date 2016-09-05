(function(window, undefined) {
    var document = window.document,
        support = {
            transform3d: ("WebKitCSSMatrix" in window && "m11" in new WebKitCSSMatrix()),
            touch: ("ontouchstart" in window)
        };

    function getTranslate(x, y) {
        var distX = x,
            distY = y;
        return support.transform3d ? "translate3d(" + distX + "px, " + distY + "px, 0)" : "translate(" + distX + "px, " + distY + "px)";
    }

    function getPage(event, page) {
        return support.touch ? event.originalEvent.changedTouches[0][page] : event[page];
    }

    ImagePinch = {
        // 给初始化数据
        init: function(param) {
            var self = this;
            self.params = param || {};

            self.scale = 1;
            self.disable = false;
            self.isMoving = false;
            self.buffMove = 5; //缓冲系数
            self.buffScale = 1.5; //放大系数
            self.morefinger = false; //触摸手指的状态 false：单手指 true：多手指
            self.overTopSide = false;   //移动超出了上边界
            self.overBottomSide = false;//移动超出了下边界
            self.overLeftSide = false;  //移动超出了左边界
            self.overRightSide = false; //移动超出了右边界
            self.isResetting = false;
            self.isTap = true;
            self.distX = 0;
            self.distY = 0;
            self.newX = 0;
            self.newY = 0;
            self.handle = self.params.handle;   //css selector

            var zoomMask = $(self.handle);
            $(self.handle).find('img').on('load', function() {
                if(self.params.verticalMoveCenter == true) {    //移动时总以垂直中心为准
                    this.style.cssText = "position: absolute;top: 50%;margin-top:-" + (this.offsetHeight / 2) + "px";
                } else {    //以父层的真实高宽移动为准
                    this.style.cssText = "position: absolute;";
                }
                self.imgBaseWidth = this.offsetWidth;     //图片基础宽度
                self.imgBaseHeight = this.offsetHeight;   //图片基础高度
                self.wrapWidth = zoomMask.width();    //可视区域宽度
                self.wrapHeight = zoomMask.height();    //可视区域高度
                self.realWidth = this.width;             //地图宽度
                self.realHeight = this.height;            //地图高度
                self.outDistY = (self.realHeight - self.wrapHeight) / 2; //图片超过一屏的时候有用
                self.width = self.realWidth - self.wrapWidth; //地图的宽度减去可视区域的宽度
                self.height = self.realHeight - self.wrapHeight; //地图的高度减去可视区域的高度
            });

            //绑定事件
            var myTouchStartFun = function(e) {
                self._touchstart(e);
            }
            self.touchStartFun = myTouchStartFun;

            var myTouchMoveFun = function(e) {
                self._touchmove(e);
            }
            self.touchMoveFun = myTouchMoveFun;

            var myTouchEndFun = function(e) {
                self._touchend(e);
            }
            self.touchEndFun = myTouchEndFun;

            $(self.handle).on("touchstart", myTouchStartFun);
            $(self.handle).on("touchmove", myTouchMoveFun);
            $(self.handle).on("touchend", myTouchEndFun);
        },
        // 重置坐标数据
        destroy: function() {
            $(this.handle).off('touchstart', this.touchStartFun);
            $(this.handle).off('touchmove', this.touchMoveFun);
            $(this.handle).off('touchend' ,this.touchEndFun);
        },
        // 更新地图信息
        _resetData: function(e) {
            if(e) {
                this.element = $(e.target).parent().find('img').get(0);
            }

            this.realWidth = this.element.offsetWidth; //地图宽度
            this.realHeight = this.element.offsetHeight; //地图高度
            this.width = this.realWidth - this.wrapWidth; //地图的宽度减去可视区域的宽度
            this.height = this.realHeight - this.wrapHeight; //地图的高度减去可视区域的高度
        },
        _touchstart: function(e) {
            var self = this;
            if(self.disable == true) return;
            self.isTap = true;

            var touchTarget = e.originalEvent.targetTouches.length; //获得触控点数
            // 获取开始坐标
            self.basePageX = getPage(e, "pageX");
            self.basePageY = getPage(e, "pageY");

            self._resetData(e); //重新初始化图片、可视区域数据，由于放大会产生新的计算

            if(self.scale == 1) {
                //原比例时只允许缩放
                if (touchTarget > 1) {
                    // 禁止默认事件
                    self.eventStop(e);
                    self.morefinger = true;
                    var _dist = self.getTouchDist(e);
                    self.startFingerDist = _dist.dist;
                    self.startFingerX = _dist.x;
                    self.startFingerY = _dist.y;
                } else {
                    self.morefinger = false;
                }
            } else {
                //放大后允许移动和缩放
                if (touchTarget == 1) {
                    self.morefinger = false;
                } else {
                    // 禁止默认事件
                    self.eventStop(e);
                    self.morefinger = true;
                    var _dist = self.getTouchDist(e);
                    self.startFingerDist = _dist.dist;
                    self.startFingerX = _dist.x;
                    self.startFingerY = _dist.y;
                }
            }
        },
        _touchmove: function(e) {
            var self = this;
            if(self.disable == true) return;
            self.isTap = false; //滑动后不触发tap事件

            var touchTarget = e.originalEvent.targetTouches.length; //获得触控点数

            if (touchTarget == 1 && !self.morefinger) {
                self._move(e);
            }

            if(touchTarget == 1 && (!self.overLeftSide && !self.overRightSide && !self.overTopSide && !self.overBottomSide)) {
                // 禁止默认事件
                self.eventStop(e);
                return false;
            }

            if (touchTarget >= 2) {
                self._zoom(e);
            }
        },
        _touchend: function(e) {
            var self = this;
            if(self.disable == true) return;

            self._resetData(e); //重新计算数据
            if (self.morefinger) {
                self.distX = -self.imgNewX;
                self.distY = -self.imgNewY;
            }

            if (self.distX > 0) {
                self.newX = 0;
            } else if (self.distX <= 0 && self.distX >= -self.width) {
                self.newX = self.distX;
                self.newY = self.distY;
            } else if (self.distX < -self.width) {
                self.newX = -self.width;
            }
            self.setImagePos(e);
            self.isMoving = false;

            if (!self.morefinger && self.isTap && self.scale > 1) {
                //被放大后，点击后复原
                self.eventStop(e);
                self.reset();
                return false;
            } else if(!self.morefinger && self.isTap && self.scale == 1) {
                if(typeof self.params.onTap == 'function') {
                    self.params.onTap(e);
                    return false;
                }
            }
        },
        _move: function(e) {

            var self = this,
                pageX = getPage(e, "pageX"), //获取移动坐标
                pageY = getPage(e, "pageY");
            self.isMoving = true;

            self.element = $(e.target).parent().find('img').get(0);

            // 获得移动距离
            self.distX = (pageX - self.basePageX) + self.newX;
            self.distY = (pageY - self.basePageY) + self.newY;

            //计算水平位移
            if (self.distX > 0) {
                self.moveX = Math.round(self.distX / self.buffMove);
            } else if (self.distX <= 0 && self.distX >= -self.width) {
                self.moveX = self.distX;
            } else if (self.distX < -self.width) {
                self.moveX = -self.width + Math.round((self.distX + self.width) / self.buffMove);
            }

            //计算垂直位移
            if(self.params.verticalMoveCenter == true) {    //移动时总以垂直中心为准
                if (self.height < 0) {  //还没有超过一屏时
                    if (self.element.offsetWidth == self.imgBaseWidth) {
                        self.moveY = Math.round(self.distY / self.buffMove);
                    } else {
                        var moveTop = Math.round((self.element.offsetHeight - self.imgBaseHeight) / 2);
                        self.moveY = -moveTop + Math.round((self.distY + moveTop) / self.buffMove);
                    }
                } else {    //超过了一屏
                    var a = Math.round((self.wrapHeight - self.imgBaseHeight) / 2),
                        b = self.element.offsetHeight - self.wrapHeight + Math.round(self.wrapHeight - self.imgBaseHeight) / 2;

                    if (self.distY >= -a) {
                        self.moveY = Math.round((self.distY + a) / self.buffMove) - a;
                    } else if (self.distY <= -b) {
                        self.moveY = Math.round((self.distY + b) / self.buffMove) - b;
                    } else {
                        self.moveY = self.distY;
                    }
                }
            } else {    //以父层的真实高宽移动为准
                if (self.height < 0) {  //还没有超过一屏时
                    self.moveY = Math.round((self.distY) / self.buffMove);
                } else {    //超过了一屏
                    var b = self.element.offsetHeight - self.wrapHeight ;

                    if (self.distY >= 0) {
                        self.moveY = Math.round((self.distY) / self.buffMove);
                    } else if (self.distY <= -b) {
                        self.moveY = Math.round((self.distY + b) / self.buffMove) - b;
                    } else {
                        self.moveY = self.distY;
                    }
                }
            }

            var xOut = 10;
            if(self.element.offsetWidth == self.imgBaseWidth) {
                xOut = 1;
            }
            self.overTopSide = self.moveY > 1 ? true : false;
            self.overBottomSide = self.moveY < -self.height - 1 ? true : false;
            self.overLeftSide = self.moveX > xOut ? true : false;
            self.overRightSide = self.moveX < -self.width - xOut ? true : false;

            //如果图片等于最初尺寸，则不进行水平移动
            if(self.element.offsetWidth == self.imgBaseWidth) {
                self.moveX = 0;
            }

            self.refresh(self.moveX, self.moveY, false, false, "0s", "ease");
            self.morefinger = false;
        },
        // 图片缩放
        _zoom: function(e) {
            var self = this;
            self.eventStop(e);

            self.element = $(e.target).parent().find('img').get(0);

            var nowFingerDist = self.getTouchDist(e).dist, //获得当前长度
                ratio = nowFingerDist / self.startFingerDist, //计算缩放比
                imgWidth = Math.round(self.realWidth * ratio), //计算图片宽度
                imgHeight = Math.round(self.realHeight * ratio); //计算图片高度

            // 计算图片新的坐标
            self.imgNewX = Math.round(self.startFingerX * ratio - self.startFingerX - self.newX * ratio);
            self.imgNewY = Math.round((self.startFingerY * ratio - self.startFingerY) / 2 - self.newY * ratio);

            var newImgWidth = 0;
            if (imgWidth >= self.imgBaseWidth) {
                self.element.style.width = imgWidth + "px";
                self.refresh(-self.imgNewX, -self.imgNewY, false, false, "0s", "ease");
                self.morefinger = true;
                newImgWidth = imgWidth;
            } else {
                if (imgWidth < self.imgBaseWidth) {
                    self.element.style.width = self.imgBaseWidth + "px";
                    newImgWidth = self.imgBaseWidth;
                }
            }

            self.scale = parseInt(newImgWidth) / self.imgBaseWidth;
            self.scale.toFixed(4);
            self.morefinger = true;
        },
        // 重置数据
        setImagePos: function(e) {
            var self = this,
                hideTime = ".2s";
            self.element = $(e.target).parent().find('img').get(0);

            if(self.params.verticalMoveCenter == true) {    //移动时总以垂直中心为准
                if (self.height < 0) {  //还没有超过一屏时
                    self.newY = -Math.round(self.element.offsetHeight - self.imgBaseHeight) / 2;
                } else {    //超过了一屏
                    var a = Math.round((self.wrapHeight - self.imgBaseHeight) / 2),
                        b = self.element.offsetHeight - self.wrapHeight + Math.round(self.wrapHeight - self.imgBaseHeight) / 2;

                    if (self.distY >= -a) {
                        self.newY = self.isResetting ? 0 : -a;
                    } else if (self.distY <= -b) {
                        self.newY = -b;
                    } else {
                        self.newY = self.distY;
                    }
                }
            } else {    //以父层的真实高宽移动为准
                if (self.height < 0) {  //还没有超过一屏时
                    self.newY = 0;
                } else {    //超过了一屏
                    var b = self.element.offsetHeight - self.wrapHeight;

                    if (self.distY >= 0) {
                        self.newY = 0;
                    } else if (self.distY <= -b) {
                        self.newY = -b;
                    } else {
                        self.newY = self.distY;
                    }
                }
            }
            self.refresh(self.newX, self.newY, false, false, hideTime, "ease-in-out");
        },
        // 执行图片移动
        refresh: function(x, y, imgWidth, imgHeight, timer, type) {
            if(typeof imgWidth != 'undefined' && imgWidth != false) {
                this.element.style.width = imgWidth + "px";

            }
            if(typeof imgHeight != 'undefined' && imgHeight != false) {
                this.element.style.height = imgHeight + "px";
            }

            this.element.style.mozTransitionProperty = 'all';//"-moz-transform";
            this.element.style.mozTransitionDuration = timer;
            this.element.style.mozTransitionTimingFunction = type;
            this.element.style.mozTransform = getTranslate(x, y);

            this.element.style.webkitTransitionProperty = 'all';//"-webkit-transform";
            this.element.style.webkitTransitionDuration = timer;
            this.element.style.webkitTransitionTimingFunction = type;
            this.element.style.webkitTransform = getTranslate(x, y);

            this.element.style.transitionProperty = 'all';//"transform";
            this.element.style.transitionDuration = timer;
            this.element.style.transitionTimingFunction = type;
            this.element.style.transform = getTranslate(x, y);
        },
        reset : function() {
            this.isResetting = true;
            this.refresh(0, 0, this.imgBaseWidth, false, "0s", "ease");
            this._resetData();
            this.distX = 0;
            this.distY = 0;
            this.newX = 0;
            this.newY = 0;
            this.scale = 1;
            this.realWidth = this.imgBaseWidth;
            this.realHeight = this.imgBaseHeight;
            this.isResetting = false;
        },
        // 获取多点触控
        getTouchDist: function(e) {
            var x1 = 0,
                y1 = 0,
                x2 = 0,
                y2 = 0,
                x3 = 0,
                y3 = 0,
                result = {};

            x1 = e.originalEvent.touches[0].pageX;
            x2 = e.originalEvent.touches[1].pageX;
            y1 = e.originalEvent.touches[0].pageY - document.body.scrollTop;
            y2 = e.originalEvent.touches[1].pageY - document.body.scrollTop;

            if (!x1 || !x2) return;

            if (x1 <= x2) {
                x3 = (x2 - x1) / 2 + x1;
            } else {
                x3 = (x1 - x2) / 2 + x2;
            }
            if (y1 <= y2) {
                y3 = (y2 - y1) / 2 + y1;
            } else {
                y3 = (y1 - y2) / 2 + y2;
            }

            result = {
                dist: Math.round(Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))),
                x: Math.round(x3),
                y: Math.round(y3)
            };
            return result;
        },
        eventStop: function(e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            } catch(e) {}
        }
    };

    window.ImagePinch = ImagePinch;

})(this);