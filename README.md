<p><img src="docs/assets/app-icon.svg" width="88" height="88" alt="purechart icon"></p>

# purechart

## What purechart does

A data-to-chart workspace for importing tables, shaping data, and choosing how to present it. It combines editable data, calculations, chart settings, captions, and export controls in a saved chart document.

## App layout

| Area | What you use it for |
| --- | --- |
| **Data sheet** | Import CSV or JSON, paste a table, or edit values in the grid. |
| **Chart forms and controls** | Choose a chart form and assign data fields, axes, and visual encodings. |
| **Chart canvas** | Inspect the rendered chart, including facets when configured. |
| **Supporting panels** | Work with calculations, presentation, captions, exports, and proposed changes. |

The app also uses the shared [puredesktop](https://puredesktop.ai) shell and drawer agent. Panels can vary with the current view and selection.

## Getting started

1. Create a chart and import a table or paste your own data.
2. Choose a chart type and map the relevant columns to the chart’s fields.
3. Adjust presentation settings, save the editable `.chart` document, and use the export controls to share the chart.

Read the [app guide](docs/app-guide.md) for development, loading, and source-layout details.

## Develop and customize

You can develop this app outside [puredesktop](https://puredesktop.ai), using your preferred editor, terminal, and coding tools, then load the module into [puredesktop](https://puredesktop.ai) to use and test it. You can also change your local version from **purefactory** or through **the app’s drawer agent**.

### Use your own development tools

1. Fork or clone this repository and work on a local copy in your editor.
2. Set up the app’s dependencies and run its development server or build. See the [app guide](docs/app-guide.md#development-and-loading) for this repository’s requirements and scripts.
3. Load the module into [puredesktop](https://puredesktop.ai). For a local web development server, the platform guide describes **File → Register App…**: register its URL, app name, and required permissions, then open it from **Browse Apps**. Keep the development server running while using that entry point.
4. Make changes in your editor, reload the app as needed, and test its file, account, and agent integrations inside the desktop. A distributable `.pureapp` package can be loaded through **File → Install App…**.

See the [app development and integration guide](https://puredesktop.ai/docs/apps/) for registration, the app manifest, the bridge, and packaging. Editing outside the desktop does not remove this module’s shared-dependency requirements.

### Use purefactory or the app’s drawer agent

Open your local app project in **purefactory** to develop it there, or open the app’s **drawer agent** and describe the change you want to make to your local version. Specify whether you want to change the app itself or work on the document or data currently open. Review the resulting source changes, run the relevant checks, and reload your local app to try them. You can keep the changes for yourself, develop a fork, or contribute them back with a pull request.

## Developer accounts and the marketplace

[Create a developer account on puredesktop.ai](https://puredesktop.ai/developers) to take part in the developer community and submit apps for review. We welcome contributions to this app, forks that take it in a different direction, and entirely new apps to offer on [puredesktop](https://puredesktop.ai).

We welcome **open-source and proprietary projects alike** to the [puredesktop](https://puredesktop.ai) marketplace. A marketplace with support for **paid apps is coming soon**, so developers will be able to charge for their apps if they choose. When distributing a fork, follow the licenses of the code and dependencies you use.

For more information about developer accounts, app submissions, or the upcoming marketplace, contact [info@puredesktop.ai](mailto:info@puredesktop.ai).

## Open source and contributions

Create data visualizations with [D3](https://github.com/d3/d3).

Anyone may use, study, modify, and share this software under the applicable licenses.
We welcome pull requests, bug reports, documentation improvements, and new ideas.
See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

### License

Original code by pure.science inc is licensed under the [MIT License](LICENSE).
Copyright (c) 2026 pure.science inc. Third-party code, dependencies, and assets retain their own licenses and copyright notices.

### Major open-source projects

| Project / source | Homepage or documentation | Support the maintainers |
| --- | --- | --- |
| [d3/d3](https://github.com/d3/d3) | [Homepage / docs](https://d3js.org) | — |
| [react/react](https://github.com/react/react) | [Homepage / docs](https://react.dev) | — |
| [styled-components/styled-components](https://github.com/styled-components/styled-components) | [Homepage / docs](https://styled-components.com) | [GitHub Sponsors](https://github.com/sponsors/quantizor) · [Open Collective](https://opencollective.com/styled-components) |

Thank you to these projects and their contributors. Additional direct dependencies,
upstream links, and asset notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
