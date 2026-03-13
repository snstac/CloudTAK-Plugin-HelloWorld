import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import MenuTemplate from './lib/MenuTemplate.vue';
import HelloWorldContainer from './lib/HelloWorldContainer.vue';
import IconHelloWorldUrl from './lib/HelloWorld.svg';
import type { Subscription } from 'rxjs';

const IconHelloWorld = {
    render: () => h('img', {
        src: IconHelloWorldUrl,
        width: 32,
        height: 32
    })
};

export default class Test implements PluginInstance {
    api: PluginAPI;

    // ---- Track everything you add so you can remove it later
    private readonly MENU_KEY = 'helloworld';
    private readonly ROUTE_NAME = 'home-menu-plugin-helloworld';
    private readonly ROUTE_PARENT = 'home-menu';

    private readonly FLOAT_UID = 'plugin-helloworld-float';

    private readonly MAP_SOURCE_ID = 'plugin-helloword-source';
    private readonly MAP_LAYER_ID = 'plugin-helloword-layer';

    // If you ever start streams at the plugin level (not just inside Vue components),
    // keep the subscriptions here.
    private subs: Subscription[] = [];

    // Keep stable function references for map.off(...)
    private onMapClick = (e: any) => {
        // Example handler (optional)
        void e;
    };

    constructor(api: PluginAPI) {
        this.api = api;
    }

    static async install(app: App, api: PluginAPI): Promise<PluginInstance> {
        void app;
        return new Test(api);
    }

    async enable(): Promise<void> {
        // 1) Add route
        this.api.routes.add({
            path: 'plugin-helloworld',
            name: this.ROUTE_NAME,
            component: {
                render: () => h(MenuTemplate, { name: 'HelloWorld', backType: 'close' }, {
                    default: () => h(HelloWorldContainer, { api: this.api })
                })
            }
        }, this.ROUTE_PARENT);

        // 2) Add menu item pointing at route name
        this.api.menu.add({
            key: this.MENU_KEY,
            label: 'HelloWorld',
            route: this.ROUTE_NAME,
            tooltip: 'HelloWorld',
            description: 'Sensor Dashboard',
            icon: IconHelloWorld
        });

        // 3) Optional: if you create any plugin-level subscriptions, do it here and track them
        // Example (commented):
        // const sub = this.api.feature.stream().subscribe(() => {});
        // this.subs.push(sub);

        // 4) Optional: if you add map handlers/layers at enable-time, do it here and track IDs
        // (In the HelloWorldContainer reference, we did it in-component instead.)
        // const map = this.api.map;
        // map.on('click', this.onMapClick);
    }

    async disable(): Promise<void> {
        // Make disable idempotent: it should be safe to call multiple times.

        // A) Stop plugin-level subscriptions
        for (const sub of this.subs) {
            try { sub.unsubscribe(); } catch { /* ignore */ }
        }
        this.subs = [];

        // B) Close floating panes created by plugin
        try {
            if (this.api.float.has(this.FLOAT_UID)) {
                this.api.float.remove(this.FLOAT_UID);
            }
        } catch {
            // ignore
        }

        // C) Remove map side-effects (handlers, layers, sources)
        try {
            const map = this.api.map;
            if (map) {
                try { map.off('click', this.onMapClick); } catch { /* ignore */ }

                try {
                    if (map.getLayer(this.MAP_LAYER_ID)) map.removeLayer(this.MAP_LAYER_ID);
                } catch { /* ignore */ }

                try {
                    if (map.getSource(this.MAP_SOURCE_ID)) map.removeSource(this.MAP_SOURCE_ID);
                } catch { /* ignore */ }
            }
        } catch {
            // ignore (map store might not be ready)
        }

        // D) Remove menu entry
        try {
            this.api.menu.remove(this.MENU_KEY);
        } catch {
            // ignore
        }

        // E) Remove route
        try {
            this.api.router.removeRoute(this.ROUTE_NAME);
        } catch {
            // ignore
        }
    }
}
