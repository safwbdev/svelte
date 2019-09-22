
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/navbar.svelte generated by Svelte v3.12.1 */

    const file = "src/navbar.svelte";

    function create_fragment(ctx) {
    	var div, h1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Player Scoreboard";
    			add_location(h1, file, 1, 4, 36);
    			attr_dev(div, "class", "navbar bg-primary");
    			add_location(div, file, 0, 0, 0);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Navbar", options, id: create_fragment.name });
    	}
    }

    /* src/player.svelte generated by Svelte v3.12.1 */

    const file$1 = "src/player.svelte";

    // (25:22) {:else}
    function create_else_block(ctx) {
    	var t;

    	const block = {
    		c: function create() {
    			t = text("+");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(t);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_else_block.name, type: "else", source: "(25:22) {:else}", ctx });
    	return block;
    }

    // (25:3) {#if showControls}
    function create_if_block_1(ctx) {
    	var t;

    	const block = {
    		c: function create() {
    			t = text("-");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(t);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_1.name, type: "if", source: "(25:3) {#if showControls}", ctx });
    	return block;
    }

    // (30:2) {#if showControls}
    function create_if_block(ctx) {
    	var button0, t1, button1, t3, input, input_updating = false, dispose;

    	function input_input_handler() {
    		input_updating = true;
    		ctx.input_input_handler.call(input);
    	}

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "+1";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "-1";
    			t3 = space();
    			input = element("input");
    			attr_dev(button0, "class", "btn");
    			add_location(button0, file$1, 30, 3, 718);
    			attr_dev(button1, "class", "btn btn-dark");
    			add_location(button1, file$1, 31, 3, 773);
    			attr_dev(input, "type", "number");
    			add_location(input, file$1, 32, 3, 840);

    			dispose = [
    				listen_dev(button0, "click", ctx.addPoint),
    				listen_dev(button1, "click", ctx.removePoint),
    				listen_dev(input, "input", input_input_handler)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, input, anchor);

    			set_input_value(input, ctx.points);
    		},

    		p: function update(changed, ctx) {
    			if (!input_updating && changed.points) set_input_value(input, ctx.points);
    			input_updating = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(button0);
    				detach_dev(t1);
    				detach_dev(button1);
    				detach_dev(t3);
    				detach_dev(input);
    			}

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(30:2) {#if showControls}", ctx });
    	return block;
    }

    function create_fragment$1(ctx) {
    	var div1, div0, h1, t0, t1, button0, t2, button1, t4, h3, t5, t6, t7, dispose;

    	function select_block_type(changed, ctx) {
    		if (ctx.showControls) return create_if_block_1;
    		return create_else_block;
    	}

    	var current_block_type = select_block_type(null, ctx);
    	var if_block0 = current_block_type(ctx);

    	var if_block1 = (ctx.showControls) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(ctx.name);
    			t1 = space();
    			button0 = element("button");
    			if_block0.c();
    			t2 = space();
    			button1 = element("button");
    			button1.textContent = "x";
    			t4 = space();
    			h3 = element("h3");
    			t5 = text(ctx.points);
    			t6 = text(" points");
    			t7 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(button0, "class", "btn btn-sm");
    			add_location(button0, file$1, 23, 2, 486);
    			attr_dev(button1, "class", "btn btn-danger btn-sm");
    			add_location(button1, file$1, 26, 2, 590);
    			attr_dev(h1, "class", "svelte-bt9zrl");
    			add_location(h1, file$1, 21, 2, 470);
    			add_location(h3, file$1, 28, 2, 669);
    			attr_dev(div0, "class", "card");
    			add_location(div0, file$1, 20, 1, 449);
    			attr_dev(div1, "class", "container");
    			add_location(div1, file$1, 19, 0, 424);

    			dispose = [
    				listen_dev(button0, "click", ctx.toggleControls),
    				listen_dev(button1, "click", ctx.onDelete)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, button0);
    			if_block0.m(button0, null);
    			append_dev(h1, t2);
    			append_dev(h1, button1);
    			append_dev(div0, t4);
    			append_dev(div0, h3);
    			append_dev(h3, t5);
    			append_dev(h3, t6);
    			append_dev(div0, t7);
    			if (if_block1) if_block1.m(div0, null);
    		},

    		p: function update(changed, ctx) {
    			if (changed.name) {
    				set_data_dev(t0, ctx.name);
    			}

    			if (current_block_type !== (current_block_type = select_block_type(changed, ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);
    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button0, null);
    				}
    			}

    			if (changed.points) {
    				set_data_dev(t5, ctx.points);
    			}

    			if (ctx.showControls) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}

    			if_block0.d();
    			if (if_block1) if_block1.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { name, points } = $$props;
    	let showControls = false;

    	const addPoint = () => ($$invalidate('points', points += 1));
    	const removePoint = () => ($$invalidate('points', points -= 1));
        const toggleControls = () => ($$invalidate('showControls', showControls = !showControls));
        const onDelete = () => dispatch("removeplayer", name);

    	const writable_props = ['name', 'points'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Player> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		points = to_number(this.value);
    		$$invalidate('points', points);
    	}

    	$$self.$set = $$props => {
    		if ('name' in $$props) $$invalidate('name', name = $$props.name);
    		if ('points' in $$props) $$invalidate('points', points = $$props.points);
    	};

    	$$self.$capture_state = () => {
    		return { name, points, showControls };
    	};

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate('name', name = $$props.name);
    		if ('points' in $$props) $$invalidate('points', points = $$props.points);
    		if ('showControls' in $$props) $$invalidate('showControls', showControls = $$props.showControls);
    	};

    	return {
    		name,
    		points,
    		showControls,
    		addPoint,
    		removePoint,
    		toggleControls,
    		onDelete,
    		input_input_handler
    	};
    }

    class Player extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$1, safe_not_equal, ["name", "points"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Player", options, id: create_fragment$1.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.name === undefined && !('name' in props)) {
    			console.warn("<Player> was created without expected prop 'name'");
    		}
    		if (ctx.points === undefined && !('points' in props)) {
    			console.warn("<Player> was created without expected prop 'points'");
    		}
    	}

    	get name() {
    		throw new Error("<Player>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Player>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points() {
    		throw new Error("<Player>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points(value) {
    		throw new Error("<Player>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/addPlayer.svelte generated by Svelte v3.12.1 */

    const file$2 = "src/addPlayer.svelte";

    function create_fragment$2(ctx) {
    	var form, input0, t0, input1, t1, input2, dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			input2 = element("input");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Player Name");
    			add_location(input0, file$2, 21, 4, 425);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Player Points");
    			add_location(input1, file$2, 22, 4, 502);
    			attr_dev(input2, "type", "submit");
    			input2.value = "Add Player";
    			attr_dev(input2, "class", "btn btn-primary");
    			add_location(input2, file$2, 23, 4, 583);
    			attr_dev(form, "action", "");
    			attr_dev(form, "class", "grid-3");
    			add_location(form, file$2, 20, 0, 368);

    			dispose = [
    				listen_dev(input0, "input", ctx.input0_input_handler),
    				listen_dev(input1, "input", ctx.input1_input_handler),
    				listen_dev(form, "submit", ctx.onSubmit)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, input0);

    			set_input_value(input0, ctx.player.name);

    			append_dev(form, t0);
    			append_dev(form, input1);

    			set_input_value(input1, ctx.player.points);

    			append_dev(form, t1);
    			append_dev(form, input2);
    		},

    		p: function update(changed, ctx) {
    			if (changed.player && (input0.value !== ctx.player.name)) set_input_value(input0, ctx.player.name);
    			if (changed.player && (input1.value !== ctx.player.points)) set_input_value(input1, ctx.player.points);
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(form);
    			}

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
            
        let player = {
            name:"",
            points: 0
        };

        const onSubmit = (e) => {
            e.preventDefault();
            dispatch("addplayer", player);
            $$invalidate('player', player = {
                name: "",
                points: 0
            });
        };

    	function input0_input_handler() {
    		player.name = this.value;
    		$$invalidate('player', player);
    	}

    	function input1_input_handler() {
    		player.points = this.value;
    		$$invalidate('player', player);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('player' in $$props) $$invalidate('player', player = $$props.player);
    	};

    	return {
    		player,
    		onSubmit,
    		input0_input_handler,
    		input1_input_handler
    	};
    }

    class AddPlayer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "AddPlayer", options, id: create_fragment$2.name });
    	}
    }

    /* src/App.svelte generated by Svelte v3.12.1 */

    const file$3 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.player = list[i];
    	return child_ctx;
    }

    // (34:1) {:else}
    function create_else_block$1(ctx) {
    	var each_1_anchor, current;

    	let each_value = ctx.players;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.players) {
    				each_value = ctx.players;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();
    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},

    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach_dev(each_1_anchor);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_else_block$1.name, type: "else", source: "(34:1) {:else}", ctx });
    	return block;
    }

    // (32:1) {#if players.length === 0}
    function create_if_block$1(ctx) {
    	var p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "No Players";
    			add_location(p, file$3, 32, 2, 603);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block$1.name, type: "if", source: "(32:1) {#if players.length === 0}", ctx });
    	return block;
    }

    // (35:2) {#each players as player}
    function create_each_block(ctx) {
    	var current;

    	var player = new Player({
    		props: { name: ctx.player.name, points: ctx.player.points },
    		$$inline: true
    	});
    	player.$on("removeplayer", ctx.removePlayer);

    	const block = {
    		c: function create() {
    			player.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(player, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var player_changes = {};
    			if (changed.players) player_changes.name = ctx.player.name;
    			if (changed.players) player_changes.points = ctx.player.points;
    			player.$set(player_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(player.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(player.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(player, detaching);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(35:2) {#each players as player}", ctx });
    	return block;
    }

    function create_fragment$3(ctx) {
    	var t0, div, t1, current_block_type_index, if_block, current;

    	var navbar = new Navbar({ $$inline: true });

    	var addplayer = new AddPlayer({ $$inline: true });
    	addplayer.$on("addplayer", ctx.addPlayer);

    	var if_block_creators = [
    		create_if_block$1,
    		create_else_block$1
    	];

    	var if_blocks = [];

    	function select_block_type(changed, ctx) {
    		if (ctx.players.length === 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(null, ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			navbar.$$.fragment.c();
    			t0 = space();
    			div = element("div");
    			addplayer.$$.fragment.c();
    			t1 = space();
    			if_block.c();
    			attr_dev(div, "class", "container");
    			add_location(div, file$3, 29, 0, 509);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(addplayer, div, null);
    			append_dev(div, t1);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(changed, ctx);
    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(changed, ctx);
    			} else {
    				group_outros();
    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});
    				check_outros();

    				if_block = if_blocks[current_block_type_index];
    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}
    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);

    			transition_in(addplayer.$$.fragment, local);

    			transition_in(if_block);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(addplayer.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);

    			if (detaching) {
    				detach_dev(t0);
    				detach_dev(div);
    			}

    			destroy_component(addplayer);

    			if_blocks[current_block_type_index].d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$3.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	
    	let players = [
    		{
    			name: "John Doe",
    			points: 53
    		},
    		{
    			name: "Sam Smith",
    			points: 45
    		},
    		{
    			name: "Sara Wilson",
    			points: 34
    		}
    	];

    	const addPlayer = (e) => {
    		const newPlayer = e.detail;
    		$$invalidate('players', players = [...players, newPlayer]);
    	};

    	const removePlayer = (e) => {
    		$$invalidate('players', players = players.filter(player => player.name !== e.detail));
    	};

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('players' in $$props) $$invalidate('players', players = $$props.players);
    	};

    	return { players, addPlayer, removePlayer };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$3.name });
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		// name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
