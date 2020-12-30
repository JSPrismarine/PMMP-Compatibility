const uniter = require('uniter');
const phar = require('phar');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

class PharComp {
    constructor(api) {
        this.api = api;
    }

    async onEnable() {
        this.api.getLogger().info('§aSuccessfully Loaded PMMP compatibility layer!§r');

        const pluginFiles = fs.readdirSync(path.join(process.cwd(), 'plugins'));
        const plugins = (await Promise.all(pluginFiles.map(async (file) => {
            return new Promise((resolve) => {
                if (!file.includes('.phar'))
                    return resolve();

                const archive = new phar.Archive();
                archive.loadPharData(fs.readFileSync(path.join(process.cwd(), 'plugins', file)));
                const files = {};

                archive.getFiles().forEach((file) => {
                    files[file.getName()] = file.getContents();
                });

                const config = YAML.parse(files['plugin.yml']);
                resolve({
                    name: config.name,
                    version: config.version,
                    description: config.description,
                    main: config.main,
                    files
                });
            });
        }))).filter(a => a);

        plugins.forEach(async (plugin) => {
            const php = uniter.createEngine('PHP');
            const api = this.api;
            this.api.getServer().getPluginManager().registerClassPlugin(plugin, new (class Plugin {
                getName() {
                    return plugin.name;
                }
                getDisplayName() {
                    return plugin.name;
                }
                getVersion() {
                    return plugin.version;
                }
                async onEnable() {
                    const main = plugin.files[`src/${plugin.main.replace('\\', '/')}.php`];
                    if (!main)
                        throw new Error('Invalid plugin entry point');

                    php.getStdout().on('data', (msg) => { api.getLogger().debug(msg) });
                    php.execute(main, `src/${plugin.main.replace('\\', '/')}.php`);
                }
                async onDisable() { }
            })());
        })
    }

    async onDisable() {
        this.api.getLogger().info('§cPlugin Disabled.§r');
    }
}

module.exports.default = PharComp;
