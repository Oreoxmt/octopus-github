# octopus-github

A userscript for GitHub with the following features:

- Quick access to the **Files changed** page of a PR
- Bulk comment on multiple PRs

## Usage

1. Install a userscript manager of your choice, such as [Tampermonkey](https://tampermonkey.net/).

2. Add the userscript by clicking [`gh-util.user.js`](https://raw.githubusercontent.com/Oreoxmt/octopus-github/main/gh-util.user.js).

3. (Optional) Configure your own GitHub [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) (`repo` scope) when you use the bulk comment feature for the first time.

## FAQs

### Why is the bulk comment feature not working?

1. Check if you have configured a Github personal access token.

2. Check if the token has the `repo` scope.

3. Check if the token has expired.

### How to manage the token used by this script?

1. Go to the **Developer Tools** of your browser and then click the **Application** tab.

2. In the **Storage** section on the left panel, click **Local Storage > https://github.com**.

3. Search for the key `octopus-github-util:token` and modify/delete it.
