<p><img src="docs/assets/app-icon.svg" width="88" height="88" alt="purechart icon"></p>

# purechart

**Turn tables into editable charts.** An app for [puredesktop](https://puredesktop.ai).

[Get started](#getting-started) · [App guide](docs/app-guide.md) · [Develop](docs/development.md) · [Developer account](https://puredesktop.ai/developers)

## What it does

A data-to-chart workspace for importing tables, shaping data, and choosing how to present it. It combines editable data, calculations, chart settings, captions, and export controls in a saved chart document.

## Requirements

Use a compatible [puredesktop](https://puredesktop.ai) build for desktop integration, storage, and the app drawer. Developer setup is covered in the [development guide](docs/development.md).

Import your own data or enter it in the grid. Agent assistance uses the host’s configured agent service.

## Getting started

1. Create a chart and import a table or paste your own data.
2. Choose a chart type and map the relevant columns to the chart’s fields.
3. Adjust presentation settings, save the editable `.chart` document, and use the export controls to share the chart.

## App layout

| Area | What you use it for |
| --- | --- |
| **Data sheet** | Import CSV or JSON, paste a table, or edit values in the grid. |
| **Chart forms and controls** | Choose a chart form and assign data fields, axes, and visual encodings. |
| **Chart canvas** | Inspect the rendered chart, including facets when configured. |
| **Supporting panels** | Work with calculations, presentation, captions, exports, and proposed changes. |

The app also uses the shared [puredesktop](https://puredesktop.ai) shell and drawer agent. Panels can vary with the current view and selection.

## Working with the agent

Open the app’s drawer in [puredesktop](https://puredesktop.ai) and describe what you want to do. For example:

> Suggest chart forms for this table.
>
> Add a caption explaining this chart.

The app exposes 30 tools, including `getChartContext`, `getChartSpec`, `getChartData`. See [agents.md](agents.md) for workflows and [plugin.json](plugin.json) for the complete tool schemas and approval flags. Some actions apply directly, while approval-marked actions ask first. Check the result in the app after a change.

## Files and data

Save editable `.chart` documents; import CSV or JSON and use export controls for presentation outputs. Keep the editable source when sharing an exported chart.

## Develop and customize

We welcome **developers and vibecoders alike**. Fork purechart, add a feature, or use what you learn to build a new app.

| Develop your way | Workflow |
| --- | --- |
| **Claude Code, Codex, or your editor** | Open the app’s source folder, read `README.md`, `plugin.json`, `package.json`, and `agents.md`, then make changes and run the app’s checks. Test inside [puredesktop](https://puredesktop.ai) with matching shared platform packages. |
| **purefactory** | Choose **Start building** for a new app, or select an available app project to extend it. Use **Open folder** for external tools and **Open app** to test. |
| **App drawer** | Request a local app change where app-development integration is available. Make clear whether you want to change the app itself or its current document. |

Use **Share** in purefactory to create a `.pureapp` package, then **Settings → System → Install an app → Choose package…** to load it in current builds. Source availability and integration vary by host build.

Follow the [development guide](docs/development.md) for Claude Code/Codex commands, app-specific setup and checks, and packaging. A standalone browser preview does not provide every desktop service.

## Documentation and limitations

| Guide | What it covers |
| --- | --- |
| [App guide](docs/app-guide.md) | App overview, source layout, and usage. |
| [Development guide](docs/development.md) | External coding tools, purefactory, checks, and installation. |
| [Agent guide](agents.md) | App-specific agent workflows and constraints. |
| [Agent contribution skill](.agents/skills/contribute-purechart/SKILL.md) | Clone or fork, implement and check changes, open PRs, create issues, and comment. |

Column mappings must match the imported data. Review calculated values, labels, and encodings before sharing.

## Contributing and marketplace

We welcome **developers and vibecoders alike**. Go to [puredesktop.ai](https://puredesktop.ai) and [create a developer account](https://puredesktop.ai/developers) to join the developer community and submit your app for review.

Bring improvements to this app, develop a fork, or build something entirely new. We welcome **open-source and proprietary projects alike** to the [puredesktop](https://puredesktop.ai) marketplace. Support for **paid apps is coming soon**, so you will be able to charge for your apps if you choose. Forks and redistributed dependencies must follow their applicable licenses.

For developer access, app submissions, or marketplace questions, contact [info@puredesktop.ai](mailto:info@puredesktop.ai).

Anyone may use, study, modify, and share this app under its applicable licenses. We welcome pull requests, bug reports, and documentation improvements. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Contribute with a coding agent

Give your agent the [contribution skill](.agents/skills/contribute-purechart/SKILL.md) and describe the change, issue, or comment you want it to make. Codex can discover it in `.agents/skills/contribute-purechart/`; with Claude Code or another tool, ask it to read that `SKILL.md` explicitly. For example:

> Read `.agents/skills/contribute-purechart/SKILL.md`, implement [describe the change], run the relevant checks, and open a pull request to `puredesktop/purechart` from my fork.

The skill includes app-specific checks and workflows for PRs, issues, and comments. Anyone with a GitHub account can contribute; merging is reserved for `esetera` and `MRdevTagg`.

## Credits and license

Create data visualizations with [D3](https://github.com/d3/d3).

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
