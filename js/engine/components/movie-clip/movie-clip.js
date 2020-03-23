/// #if EDITOR
import game from '../../game.js';
import Lib from '../../lib.js';


const ICON_STOP = R.img({src: '/thing-editor/img/timeline/stop.png'});
const ICON_REMOVE = R.img({src: '/thing-editor/img/timeline/remove.png'});
const ICON_DEFAULT = R.img({src: '/thing-editor/img/timeline/default.png'});

/// #endif


import DSprite from '../d-sprite.js';
import Pool from "../../utils/pool.js";
import FieldPlayer from "./field-player.js";
import getValueByPath from 'thing-editor/js/engine/utils/get-value-by-path.js';


let idCounter = 1;

export default class MovieClip extends DSprite {
	
	constructor() {
		super();
		this.fieldPlayers = [];
	}

	update() {
		if (this.isPlaying) {
			if (this.delay > 0) {
				this.delay--;
			} else {
				if(this._goToLabelNextFrame) {
					let label = this._timelineData.l[this._goToLabelNextFrame];
					this._goToLabelNextFrame = false;
					let l = this.fieldPlayers.length;
					for(let i =0; i < l; i++) {
						this.fieldPlayers[i].goto(label.t, label.n[i]);
					}
				}

				for(let p of this.fieldPlayers) {
					p.update();
				}
			}
		}
		super.update();
	}

	static _findNextKeyframe (timeLineData, time) {
		let ret;
		for(let f of timeLineData) {
			if(f.t > time) {
				return f;
			}
			ret = f;
		}
		return ret;
	}
	
	static _findPreviousKeyframe (timeLineData, time) {
		let ret;
		for(let f of timeLineData) {
			if(f.t > time) {
				return ret;
			}
			ret = f;
		}
		return ret;
	}
	
	static _deserializeTimelineData(tl) {
		let fields = tl.f.map((f) => {
			
			let fieldTimeline = f.t.map((k) => {
				/// #if EDITOR
				if(!k.hasOwnProperty('___react_id')) {
					k.___react_id = MovieClip.__generateKeyframeId();
				}
				/// #endif
				let ret =  Object.assign({}, k);
				if(!ret.hasOwnProperty('j')) {
					ret.j = ret.t;
				}
				if(!ret.hasOwnProperty('m')) {
					ret.m = 0; //- SMOOTH
				}
				return ret;
			});
			for(let f of fieldTimeline) {
				f.n = MovieClip._findNextKeyframe(fieldTimeline, f.j);
			}
			return {
				n: f.n,
				t: fieldTimeline
			};
		});
		
		let labels = {};
		for(let key in tl.l) {
			let labelTime = tl.l[key];
			let nextList = fields.map((field) => {
				return MovieClip._findNextKeyframe(field.t, labelTime - 1);
			});
			labels[key] = {t: labelTime, n: nextList};
		}
		return {
			l: labels,
			p: tl.p,
			d: tl.d,
			f: fields
		};
	}

	_disposePlayers() {
		while (this.fieldPlayers.length > 0) {
			Pool.dispose(this.fieldPlayers.pop());
		}
	}

	set timeline(data) {
		this._goToLabelNextFrame = false;
		this._disposePlayers();
		
		if(data === null) {
			this._timelineData = null;
			return;
		}

		if(!deserializeCache.has(data)
		/// #if EDITOR
			|| editor.disableFieldsCache
		/// #endif
		) {
			let desData = MovieClip._deserializeTimelineData(data);
			/// #if EDITOR
			if (!editor.disableFieldsCache) {
				/// #endif
				deserializeCache.set(data, desData);
				/// #if EDITOR
				serializeCache.set(desData, data);
			}
			/// #endif
			data = desData;
		} else {
			data = deserializeCache.get(data);
		}
		
		assert(Array.isArray(data.f), "Wrong timeline data?");
		this._timelineData = data;

		let pow = data.p; //smooth fields dynamic parameters
		let damper = data.d;
		
		
		let fieldsData = data.f;
		for(let i = 0; i < fieldsData.length; i++) {
			let p = Pool.create(FieldPlayer);
			p.init(this, fieldsData[i], pow, damper);
			this.fieldPlayers.push(p);
		}
	}
	
	resetTimeline() {
		for (let p of this.fieldPlayers) {
			p.reset();
		}
	}
	
	hasLabel(labelName) {
		/// #if EDITOR
		if(!this._timelineData) {
			editor.ui.status.error("MovieClip has no timeline.", 32003, this, 'timeline');
			return;
		}
		/// #endif
		return this._timelineData.l.hasOwnProperty(labelName);
	}
	
	gotoLabel(labelName) {
		assert(this.hasLabel(labelName), "Label '" + labelName + "' not found.", 10055);
		/// #if EDITOR
		if(this.__logLevel) {
			let stack = editor.__getCurrentStack("gotoLabel");
			if(this._goToLabelNextFrame) {
				editor.ui.status.warn('CANCELED label: ' + this._goToLabelNextFrame + '; time: ' + game.time, 99999, this, undefined, true);
			}
			editor.ui.status.warn(
				R.span(null, 
					R.btn('Show stack...', () => {
						editor.showStack(stack);
					}),
					'gotoLabel: ' + labelName + '; time: ' + game.time
				),
				99999, this, undefined, true);
		}
		/// #endif
		this._goToLabelNextFrame = labelName;
		this.play();
	}

	gotoRandomLabel() {
		assert(arguments.length > 1, "Two or more arguments expected for method gotoRandomLabel.", 10056);
		this.gotoLabel(arguments[Math.floor(Math.random() * arguments.length)]);
	}

	gotoLabelIf(labelName, variablePath, invert) {
		if((!getValueByPath(variablePath, this)) !== (!invert)) {
			this.gotoLabel(labelName);
		}
	}
	
	play() {
		this.isPlaying = true;
	}
	
	stop() {
		this.isPlaying = false;
	}
	
	playRecursive() {
		this.isPlaying = true;
		for (let c of this.findChildrenByType(MovieClip)) {
			c.isPlaying = true;
		}
	}
	
	stopRecursive() {
		this.isPlaying = false;
		for (let c of this.findChildrenByType(MovieClip)) {
			c.isPlaying = false;
		}
	}

	/// #if EDITOR

	__EDITOR_getKeyframeIcon(action) {
		switch(action) {
		case 'this.stop':
			return ICON_STOP;
		case 'this.remove':
		case 'this.parent.remove':
		case 'this.parent.parent.remove':
			return ICON_REMOVE;
		default:
			return ICON_DEFAULT;
		}
	}

	//timeline reading has sense in editor mode only
	get timeline() { //serialize timeline to save in Lib as json. Replace keyframes references to indexes
		if(!this._timelineData || editor.ui.propsEditor.__isPropsRenderingAccessTime) {
			return null;
		}
		if(!serializeCache.has(this._timelineData) ||
		editor.disableFieldsCache
		) {
			//console.warn("MovieClip serialization invoked >>>");
			let tl = this._timelineData;
			let fields = tl.f.map((f) => {
				return {
					n: f.n,
					t: f.t.map((k) => {
						let ret = Object.assign({}, k);
						let tmpJ = ret.j;
						if(ret.j === ret.t && !k.___keepLoopPoint) {
							delete(ret.j);
						}

						if((typeof this[f.n]) !== 'number') {
							delete ret.s;
						}

						if(ret.m === 0) {
							delete ret.m;
						}
						if(ret.r === 0) {
							delete ret.r;
						} else if (ret.r > 0) {
							ret.r = Math.min(ret.r , ret.n.t - tmpJ - 1);
						}
						delete ret.n;
						return ret;
					})
				};
			});

			let labels = {};
			for(let key in tl.l) {
				let label = tl.l[key];
				labels[key] = label.t;
			}
			let c = {
				l: labels,
				p: tl.p,
				d: tl.d,
				f: fields
			};
			if(editor.disableFieldsCache) {
				return c;
			}
			serializeCache.set(this._timelineData, c);
		}
		return serializeCache.get(this._timelineData);
	}

	static invalidateSerializeCache (o) {
		assert(o instanceof MovieClip, "MovieClip expected");
		let timelineData = o._timelineData;
		Lib.__invalidateSerializationCache(o);
		deserializeCache.delete(serializeCache.get(timelineData));
		serializeCache.delete(timelineData);
	}

	__onUnselect() {
		editor.deselectMovieClip(this);
	}


	static __generateKeyframeId() {
		return idCounter++;
	}

	__afterSerialization(data) {
		if(data.p.timeline) {
			for(let f of data.p.timeline.f) {
				delete data.p[f.n];
			}
		}
	}

	__checkVisibilityForEditor() {
		if(game.__EDITOR_mode) {
			if(this._timelineData && this._timelineData.f) {
				let fields = this._timelineData.f;
				if(fields.find(f => f.n === 'visible')) {
					this.visible |= !this.__lockSelection;
				}
				if((this.alpha < 0.1) && fields.find(f => f.n === 'alpha')) {
					this.alpha = 1;
				}
				if((Math.abs(this.scale.x) < 0.02) && fields.find(f => f.n === 'scale.x')) {
					this.scale.x = 1;
				}
				if((Math.abs(this.scale.y) < 0.02) && fields.find(f => f.n === 'scale.y')) {
					this.scale.y = 1;
				}
			}
		}
	}

	__afterDeserialization() {
		if(game.__EDITOR_mode) {
			this.resetTimeline();
		}
	}

	__onSelect() {
		super.__onSelect();
		this.__checkVisibilityForEditor();
	}

	__onChildSelected() {
		this.__checkVisibilityForEditor();
	}

	set __previewFrame(v) {
		this.___previewFrame = v;
		if(game.__EDITOR_mode) {
			this.resetTimeline();
		}
	}

	get __previewFrame() { // 99999
		return this.___previewFrame;
	}

	/// #endif
}


let deserializeCache = new WeakMap();

/// #if EDITOR

MovieClip.prototype.play.___EDITOR_isGoodForChooser = true;
MovieClip.prototype.stop.___EDITOR_isGoodForChooser = true;
MovieClip.prototype.playRecursive.___EDITOR_isGoodForChooser = true;
MovieClip.prototype.stopRecursive.___EDITOR_isGoodForChooser = true;
MovieClip.prototype.gotoLabel.___EDITOR_isGoodForChooser = true;

let serializeCache = new WeakMap();
MovieClip.__EDITOR_group = 'Basic';
MovieClip.__EDITOR_icon = 'tree/movie';
__EDITOR_editableProps(MovieClip, [
	{
		type: 'splitter',
		title: 'MovieClip:',
		name: 'movie-clip'
	},
	{
		name: 'isPlaying',
		type: Boolean,
		default: true,
		notAnimate: true
	},
	{
		name: 'delay',
		type: Number,
		min: 0,
		notAnimate: true
	},
	{
		name: 'timeline',
		type: 'timeline'
	},
	{
		name: '__logLevel', // 99999
		type: Number,
		select: [
			{name: 'disabled', value: 0},
			{name: 'level 1', value: 1},
			{name: 'level 2', value: 2}
		]
	},
	{
		name: '__previewFrame',
		type: Number,
		min: 0
	}
]);

/// #endif