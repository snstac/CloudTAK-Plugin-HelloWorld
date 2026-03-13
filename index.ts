import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import MenuTemplate from './lib/MenuTemplate.vue';
import HelloWorldContainer from './lib/HelloWorldContainer.vue';
import IconHelloWorldUrl from './lib/HelloWorld.svg';

const IconHelloWorld = {
    render: () => h('img', {
        src: IconHelloWorldUrl,
        width: 32,
        height: 32
    })
};

export default class Test {
    api: PluginAPI;

    constructor(api: PluginAPI) {
        this.api = api;
    }

    static async install(
        app: App,
        api: PluginAPI
    ): Promise<PluginInstance> {
        return new Test(api);
    }

    async enable(): Promise<void> {
        this.api.routes.add({
            path: 'plugin-helloworld',
            name: 'home-menu-plugin-helloworld',
            component: {
                render: () => h(MenuTemplate, { name: 'HelloWorld', backType: 'close' }, {
                    default: () => h(HelloWorldContainer, { api: this.api })
                })
            }
        }, 'home-menu');

        this.api.menu.add({
            key: 'HelloWorld',
            label: 'HelloWorld',
            route: 'home-menu-plugin-helloworld',
            tooltip: 'HelloWorld',
            description: 'Hello World Plugin',
            icon: IconHelloWorld
        });
    }

    async disable(): Promise<void> {
        this.api.menu.remove('HelloWorld');
        this.api.router.removeRoute('home-menu-plugin-helloworld');
    }
}
