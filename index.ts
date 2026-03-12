import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
import MenuTemplate from './lib/MenuTemplate.vue';
import SampleContainer from './lib/SampleContainer.vue';
import IconSampleUrl from './lib/Sample.svg';

const IconSample = {
    render: () => h('img', {
        src: IconSampleUrl,
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
            path: 'plugin-sample',
            name: 'home-menu-plugin-sample',
            component: {
                render: () => h(MenuTemplate, { name: 'Sample', backType: 'close' }, {
                    default: () => h(SampleContainer, { api: this.api })
                })
            }
        }, 'home-menu');

        this.api.menu.add({
            key: 'sample',
            label: 'Sample',
            route: 'home-menu-plugin-sample',
            tooltip: 'Sample',
            description: 'Sensor Dashboard',
            icon: IconSample
        });
    }

    async disable(): Promise<void> {
        this.api.menu.remove('sample');
        this.api.router.removeRoute('home-menu-plugin-sample');
    }
}
