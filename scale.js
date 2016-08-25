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
        return support.touch ? event.changedTouches[0][page] : event[page];
    }

    var ImagePinch = function() {};
    ImagePinch.prototype = {
        // 给初始化数据
        init: function(imgDom, param) {
            var self = this;
            self.params = param || {};

            self.scale = 1;
            self.isMoving = false;
            self.buffMove = 5; //缓冲系数
            self.buffScale = 1.5; //放大系数
            self.finger = false; //触摸手指的状态 false：单手指 true：多手指
            self.overTopSide = false;   //移动超出了上边界
            self.overBottomSide = false;//移动超出了下边界
            self.overLeftSide = false;  //移动超出了左边界
            self.overRightSide = false; //移动超出了右边界
            self.isResetting = false;
            self.distX = 0;
            self.distY = 0;
            self.newX = 0;
            self.newY = 0;

            var zoomMask = imgDom.parentNode;
            if(self.params.verticalMoveCenter == true) {    //移动时总以垂直中心为准
                imgDom.style.cssText = "position: absolute;top: 50%;margin-top:-" + (imgDom.offsetHeight / 2) + "px";
            } else {    //以父层的真实高宽移动为准
                imgDom.style.cssText = "position: absolute;";
            }
            self.imgBaseWidth = imgDom.offsetWidth;     //图片基础宽度
            self.imgBaseHeight = imgDom.offsetHeight;   //图片基础高度
            self.element = imgDom;
            self.params.wrapWidth = zoomMask.offsetWidth;    //可视区域宽度
            self.params.wrapHeight = zoomMask.offsetHeight;    //可视区域高度
            self.params.realWidth = imgDom.width;             //地图宽度
            self.params.realHeight = imgDom.height;            //地图高度
            self.addEventStart();
        },
        addEventStart: function() {
            var self = this;

            self.wrapWidth = self.params.wrapWidth || 0; //可视区域宽度
            self.wrapHeight = self.params.wrapHeight || 0; //可视区域高度
            self.realWidth = self.params.realWidth || 0; //地图宽度
            self.realHeight = self.params.realHeight || 0; //地图高度

            self.outDistY = (self.realHeight - self.wrapHeight) / 2; //图片超过一屏的时候有用

            self.width = self.realWidth - self.wrapWidth; //地图的宽度减去可视区域的宽度
            self.height = self.realHeight - self.wrapHeight; //地图的高度减去可视区域的高度

            self.element.addEventListener("touchstart", function(e) {
                self._touchstart(e);
            }, false);
            self.element.addEventListener("touchmove", function(e) {
                self._touchmove(e);
            }, false);
            self.element.addEventListener("touchend", function(e) {
                self._touchend(e);
            }, false);
        },
        // 重置坐标数据
        _destroy: function() {
            this.distX = 0;
            this.distY = 0;
            this.newX = 0;
            this.newY = 0;
            this.scale = 1;
            this.realWidth = this.imgBaseWidth;
            this.realHeight = this.imgBaseHeight;
        },
        // 更新地图信息
        _changeData: function() {
            this.realWidth = this.element.offsetWidth; //地图宽度
            this.realHeight = this.element.offsetHeight; //地图高度
            //this.outDistY = (this.realHeight - this.wrapHeight)/2; //当图片高度超过屏幕的高度时候。图片是垂直居中的，这时移动有个高度做为缓冲带
            this.width = this.realWidth - this.wrapWidth; //地图的宽度减去可视区域的宽度
            this.height = this.realHeight - this.wrapHeight; //地图的高度减去可视区域的高度
        },
        _touchstart: function(e) {
            var self = this;

            self.tapDefault = false;

            var touchTarget = e.targetTouches.length; //获得触控点数

            self._changeData(); //重新初始化图片、可视区域数据，由于放大会产生新的计算

            if (touchTarget == 1) {
                // 获取开始坐标
                self.basePageX = getPage(e, "pageX");
                self.basePageY = getPage(e, "pageY");

                self.finger = false;
            } else {
                // 禁止默认事件
                self.eventStop(e);

                self.finger = true;

                self.startFingerDist = self.getTouchDist(e).dist;
                self.startFingerX = self.getTouchDist(e).x;
                self.startFingerY = self.getTouchDist(e).y;
            }
        },
        _touchmove: function(e) {
            var self = this;
            self.tapDefault = true;

            var touchTarget = e.targetTouches.length; //获得触控点数

            if (touchTarget == 1 && !self.finger) {
                self._move(e);
            }

            if(!self.overLeftSide && !self.overRightSide && !self.overTopSide && !self.overBottomSide) {
                // 禁止默认事件
                self.eventStop(e);
            }

            if (touchTarget >= 2) {
                self._zoom(e);
            }
        },
        _touchend: function(e) {
            var self = this;
            console.log(self.tapDefault)

            if (!self.finger && !self.tapDefault && self.scale > 1) {
                // 禁止默认事件
                self.eventStop(e);
                self.reset();
                return;
            } else if(!self.finger && !self.tapDefault && self.scale == 1) {
                if(typeof self.params.onTap == 'function') {
                    self.params.onTap(e);
                }
            }

            self._changeData(); //重新计算数据
            if (self.finger) {
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
            self.setImagePos();
            self.isMoving = false;
        },
        _move: function(e) {

            var self = this,
                pageX = getPage(e, "pageX"), //获取移动坐标
                pageY = getPage(e, "pageY");
            self.isMoving = true;

            // 获得移动距离
            self.distX = (pageX - self.basePageX) + self.newX;
            self.distY = (pageY - self.basePageY) + self.newY;

            if (self.distX > 0) {
                self.moveX = Math.round(self.distX / self.buffMove);
            } else if (self.distX <= 0 && self.distX >= -self.width) {
                self.moveX = self.distX;
            } else if (self.distX < -self.width) {
                self.moveX = -self.width + Math.round((self.distX + self.width) / self.buffMove);
            }
            self.overTopSide = self.moveY > 10 ? true : false;
            self.overBottomSide = self.moveY < -self.height - 10 ? true : false;
            self.overLeftSide = self.moveX > 10 ? true : false;
            self.overRightSide = self.moveX < -self.width - 10 ? true : false;

            self.movePos();
            self.finger = false;
        },
        // 图片缩放
        _zoom: function(e) {
            var self = this;
            self.eventStop(e);

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
                self.finger = true;
                newImgWidth = imgWidth;
            } else {
                if (imgWidth < self.imgBaseWidth) {
                    self.element.style.width = self.imgBaseWidth + "px";
                    newImgWidth = self.imgBaseWidth;
                }
            }

            self.scale = parseInt(newImgWidth) / self.imgBaseWidth;
            self.scale.toFixed(4);
            self.finger = true;
        },
        // 移动坐标
        movePos: function() {
            var self = this;

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
            self.refresh(self.moveX, self.moveY, false, false, "0s", "ease");
        },
        // 重置数据
        setImagePos: function() {
            var self = this,
                hideTime = ".2s";
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
            this.refresh(0, 0, this.imgBaseWidth, false, ".1s", "ease");
            this._changeData();
            this._destroy();
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

            x1 = e.touches[0].pageX;
            x2 = e.touches[1].pageX;
            y1 = e.touches[0].pageY - document.body.scrollTop;
            y2 = e.touches[1].pageY - document.body.scrollTop;

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
            e.preventDefault();
            e.stopPropagation();
            try {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            } catch(e) {}
        }
    };

    window.ImagePinch = ImagePinch;

})(this);