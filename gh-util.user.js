// ==UserScript==
// @name         Octopus GitHub
// @version      0.90
// @description  A userscript for GitHub
// @author       Oreo
// @homepage     https://github.com/Oreoxmt/octopus-github
// @updateURL    https://github.com/Oreoxmt/octopus-github/raw/main/gh-util.user.js
// @downloadURL  https://github.com/Oreoxmt/octopus-github/raw/main/gh-util.user.js
// @supportURL   https://github.com/Oreoxmt/octopus-github
// @match        https://github.com/*/pulls*
// @match        https://github.com/*/pull/*
// @run-at       document-start
// @require      https://cdnjs.cloudflare.com/ajax/libs/rest.js/15.2.6/octokit-rest.js
// ==/UserScript==

(function () {

    'use strict';

    const ATTR = 'octopus-github-util-mark'
    const STORAGEKEY = 'octopus-github-util:token'
    const TARGET_REPO_OWNER = 'pingcap'

    function GetRepositoryInformation() {
        // Get the pathname of the current page
        var pathname = location.pathname;

        // Split the pathname into an array of parts
        var parts = pathname.split('/');

        // Return an object containing the user name and repository name
        return {
            owner: parts[1],
            name: parts[2],
        }
    }

    function EnsureToken() {
        var token = localStorage.getItem(STORAGEKEY)
        if (!token) {
            // Prompt user to set token
            // TODO: Use HTML element instead of prompt
            token = prompt('Enter your GitHub token:');
            if (!token) {
                throw 'No token set'
            }
            localStorage.setItem(STORAGEKEY, token);
        }
        return token;
    }

    // This function can be used to leave a comment on a specific PR
    function LeaveCommentOnPR(commentLink, comment) {
        // Send the POST request to the GitHub API
        // TODO: Use Octokit to create requests
        fetch(commentLink, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${EnsureToken()}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'body': comment
            })
        }).then((response) => {
            console.log('response to ', commentLink, response)
        }).catch((error) => {
            console.log('error on ', commentLink, error)
        })
    }

    // This function can be used to get the GitHub login name of the current user
    async function GetMyGitHubID() {
        try {
            const userURL = 'https://api.github.com/user';
            const response = await fetch(userURL, {
                headers: {'Authorization': `Bearer ${EnsureToken()}`,},
            });

            if (response.ok) {
                const userData = await response.json();
                return userData.login;
            } else {
                throw new Error('Failed to fetch current user login name.');
            }
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    // This function can be used to get the PR title, description, label, base, and head information
    function GetPRInfo(octokit, messageTextElement, RepoOwner, RepoName, PRNumber) {
        return new Promise((resolve, reject) => {
            octokit.pullRequests.get({
                owner: RepoOwner,
                repo: RepoName,
                number: PRNumber,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            })
                .then(response => {
                const PRData = response.data;
                const sourceTitle = PRData.title;
                const sourceDescription = PRData.body;
                const sourceLabels = PRData.labels.map(label => label.name);
                const baseRepo = PRData.base.repo.full_name;
                const baseBranch = PRData.base.ref;
                const headRepo = PRData.head.repo.full_name;
                const headBranch = PRData.head.ref;

                messageTextElement.innerHTML += `[Log]: Getting the source language PR information...<br>`;
                console.log(`Getting source language PR information was successful. The head branch name is: ${headBranch}`);

                const result = [sourceTitle, sourceDescription, sourceLabels, baseRepo, baseBranch, headRepo, headBranch];
                resolve(result);
            })
                .catch(error => {
                messageTextElement.innerHTML += `<br>[Error]: Failed to get the source language PR information: ${error.message}`;
                reject(error);
            });
        });
    }

    // This function can be used to sync the latest content from the upstream branch to your own branch
    async function SyncMyRepoBranch(octokit, messageTextElement, targetRepoOwner, targetRepoName, myRepoOwner, myRepoName, baseBranch) {
        try {
            const upstreamRef = await octokit.gitdata.getReference({
                owner: targetRepoOwner,
                repo: targetRepoName,
                ref: `heads/${baseBranch}`,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            const upstreamSHA = upstreamRef.data.object.sha;
            console.log(upstreamSHA);

            messageTextElement.innerHTML += `[Log]: Syncing the latest content from the upstream branch...<br>`;
            await octokit.gitdata.updateReference({
                owner: myRepoOwner,
                repo: myRepoName,
                ref: `heads/${baseBranch}`,
                sha: upstreamSHA,
                force: true,
                headers: { 'Authorization': `Bearer ${EnsureToken()}` }
            });
            console.log("The content sync is successful!");
        } catch (error) {
            const myRepoUrl = `https://github.com/${myRepoOwner}/${myRepoName}`;
            const myBranchesUrl = `${myRepoUrl}/branches`;
            const baseBranchUrl = `${myRepoUrl}/tree/${baseBranch}`;
            const myRepoResponse = await fetch(myRepoUrl, { method: 'HEAD' });
            if (myRepoResponse.ok) {
                const baseBranchResponse = await fetch(baseBranchUrl, { method: 'HEAD' });
                messageTextElement.innerHTML += baseBranchResponse.ok ? `<br>[Error]: Failed to sync the <a href="${baseBranchUrl}" target="_blank">${baseBranch}</a> branch of your forked <a href="${myRepoUrl}" target="_blank">${myRepoOwner}</a> repo. <br> You need to manually sync your <a href="${baseBranchUrl}" target="_blank">${baseBranch}</a> branch from the upstream branch first.<br>` : `<br>[Error]: Your forked <a href="${myRepoUrl}" target="_blank">${myRepoName}</a> repo does not have the ${baseBranch} branch yet. <br> You need to manually <a href="${myBranchesUrl}" target="_blank">create the ${baseBranch} branch</a> in your repo based on the upstream.<br>`;
            } else {
                messageTextElement.innerHTML += `<br>[Error]: Failed to sync the latest content from the upstream branch to your branch. Please check whether you have forked the <a href="https://github.com/${targetRepoOwner}/${targetRepoName}" target="_blank">${targetRepoOwner}/${targetRepoName}</a> repo. If not, you need to fork the <a href="https://github.com/${targetRepoOwner}/${targetRepoName}" target="_blank">${targetRepoOwner}/${targetRepoName}</a> repo with all its branches first.<br>`;
            }
            console.log(error);
            throw error;
        }
    }

    // This function can be used to create a new branch in your repo
    async function CreateBranch(octokit, messageTextElement, repoOwner, repoName, branchName, baseBranch) {
        try {
            const baseRef = await octokit.gitdata.getReference({
                owner: repoOwner,
                repo: repoName,
                ref: `heads/${baseBranch}`,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            const baseSha = baseRef.data.object.sha;
            console.log(baseSha);

            messageTextElement.innerHTML += `[Log]: Creating a branch for the translation PR...<br>`;
            await octokit.gitdata.createReference({
                owner: repoOwner,
                repo: repoName,
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            const branchUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branchName}`;
            console.log(`A new branch is created successfully. The branch address is: ${branchUrl}`);

        } catch (error) {
            const branchesUrl = `https://github.com/${repoOwner}/${repoName}/branches`;
            const targetBranchUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branchName}`;
            console.log(targetBranchUrl)
            fetch(targetBranchUrl, { method: 'HEAD' })
              .then(response => {
                messageTextElement.innerHTML += response.ok ? `<br>[Error]: Failed to create the branch for the translation PR. <br> The target branch <a href="${targetBranchUrl}" target="_blank">${branchName}</a> already exists in your <a href="${branchesUrl}" target="_blank">repo</a>. You need to manually create a new translation PR with a different branch name.` : `<br>[Error]: Failed to create the branch for the translation PR:<br> ${error.message}`;
              });
            console.error(error);
            throw error;
        }
    }

    // This function can be used to create a temp file in your specified branch
    async function CreateFileInBranch(octokit, messageTextElement, repoOwner, repoName, branchName, filePath, fileContent, commitMessage) {
        try {
            const contentBase64 = btoa(fileContent);
            const response = await octokit.repos.createFile({
                owner: repoOwner,
                repo: repoName,
                branch: branchName,
                path: filePath,
                message: commitMessage,
                content: contentBase64,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            console.log('A temp file is created successfully!');

        } catch (error) {
            //console.log('Failed to create the temp file.');
            messageTextElement.innerHTML += `<br>[Error]: Failed to create a temp file in the new branch: ${error.message}<br>`;
            console.error(error);
        }
    }

    // This function can be used to modify the description of the translation PR
    function UpdatePRDescription(sourceRepoOwner, sourceRepoName, sourcePRNumber, sourceDescription, targetRepoName) {
        const sourcePRCLA = "https://cla-assistant.io/pingcap/" + sourceRepoName;
        const newPRCLA = "https://cla-assistant.io/pingcap/" + targetRepoName;
        const sourcePRURL = `https://github.com/${sourceRepoOwner}/${sourceRepoName}/pull/${sourcePRNumber}`;
        let newPRDescription = sourceDescription.replace(sourcePRCLA, newPRCLA);

        newPRDescription = newPRDescription.replace("This PR is translated from:", "This PR is translated from: " + sourcePRURL);
        const regexConstructor = new RegExp(".*?\\tips for choosing the affected versions.*?\\n\\n?", "g");
        newPRDescription = newPRDescription.replace(regexConstructor, "");
        console.log(newPRDescription)

        return newPRDescription;
    }

    // This function can be used to create a pull request based on your specified branch
    async function CreatePullRequest(octokit, messageTextElement, targetRepoOwner, targetRepoName, baseBranch, myRepoOwner, myRepoName, newBranchName, title, body, labels) {
        try {
            messageTextElement.innerHTML += `[Log]: Creating the empty translation PR...<br>`;
            const prResponse = await octokit.pullRequests.create({
                owner: targetRepoOwner,
                repo: targetRepoName,
                title: title,
                body: body,
                head: `${myRepoOwner}:${newBranchName}`,
                base: baseBranch,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            try {
                console.log(prResponse);
                const prUrl = prResponse.data.html_url;
                //console.log(`Your target PR is created successfully. The PR address is: ${prUrl}`);
                messageTextElement.innerHTML += `<br> Your target PR is created successfully. <br> The PR address is:<br> <a href="${prUrl}" target="_blank">${prUrl}</a> <br>`;
                const urlParts = prUrl.split("/");
                const prNumber = urlParts[6];

                // Add labels to the created PR
                const labelsResponse = await octokit.issues.addLabels({
                    owner: targetRepoOwner,
                    repo: targetRepoName,
                    number: prNumber,
                    labels: labels,
                    headers: {'Authorization': `Bearer ${EnsureToken()}`}
                });

                console.log('Labels are added successfully.');
                return prUrl;

            } catch (error) {
                console.log('Failed to add the PR labels.');
                console.error(error);
            }

        } catch (error) {
            console.log('Failed to create the translation PR.');
            messageTextElement.innerHTML += `<br>[Error]: Failed to create the translation PR: ${error.message}<br>`;
            console.error(error);
        }
    }

    async function DeleteFileInBranch(octokit, repoOwner, repoName, branchName, filePath, commitMessage) {
        try {
            const { data: fileInfo } = await octokit.repos.getContent({
                owner: repoOwner,
                repo: repoName,
                path: filePath,
                ref: branchName,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            await octokit.repos.deleteFile({
                owner: repoOwner,
                repo: repoName,
                path: filePath,
                message: commitMessage,
                sha: fileInfo.sha,
                branch: branchName,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            console.log("The temp.md is deleted successfully!");
        } catch (error) {
            console.log(`Failed to delete temp.md. Error message: ${error.message}`);
            throw error;
        }
    }

    // This function can be used to check if the current user has write permission to the target repository
    async function CheckRepositoryWritePermission(targetRepoOwner, targetRepoName) {
        try {
            const repoUrl = `https://api.github.com/repos/${targetRepoOwner}/${targetRepoName}`;
            const response = await fetch(repoUrl, {
                headers: {
                    'Authorization': `Bearer ${EnsureToken()}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (response.ok) {
                const repoData = await response.json();
                // Check if user has write permission (push access)
                return repoData.permissions && (repoData.permissions.push || repoData.permissions.admin);
            }
            return false;
        } catch (error) {
            console.error('Failed to check repository permissions:', error);
            return false;
        }
    }

    // This function can be used to trigger a workflow in the forked repository
    async function TriggerWorkflow(octokit, messageTextElement, targetRepoOwner, targetRepoName, baseBranch, sourcePRURL, targetPRURL) {
        try {
            // Check if user has write permission to the forked repository
            const hasWritePermission = await CheckRepositoryWritePermission(targetRepoOwner, targetRepoName);

            if (!hasWritePermission) {
                messageTextElement.innerHTML += `<br>[Error]: You don't have write permission for the repository ${targetRepoOwner}/${targetRepoName}, so the translation workflow cannot be triggered automatically.<br>`;
                messageTextElement.innerHTML += `[Info]: Please check your repository permissions and ensure the workflow file exists in that repository.<br>`;
                return;
            }

            let workflowFileName;

            // Determine which workflow to trigger based on the target repository name
            if (targetRepoName === "docs") {
                workflowFileName = "sync-doc-pr-zh-to-en.yml";
            } else if (targetRepoName === "docs-cn") {
                workflowFileName = "sync-doc-pr-en-to-zh.yml";
            } else {
                console.log(`No workflow configured for repository: ${targetRepoName}`);
                return;
            }

            messageTextElement.innerHTML += `<br> [Log]: Triggering workflow ${workflowFileName} in ${targetRepoOwner}/${targetRepoName} to translate the current PR...<br>`;

            const workflowDispatchUrl = `https://api.github.com/repos/${targetRepoOwner}/${targetRepoName}/actions/workflows/${workflowFileName}/dispatches`;

            const requestBody = {
                ref: baseBranch,
                inputs: {
                    source_pr_url: sourcePRURL,
                    target_pr_url: targetPRURL,
                    ai_provider: 'gemini'
                }
            };

            console.log(`Triggering workflow with URL: ${workflowDispatchUrl}`);
            console.log(`Request body:`, requestBody);

            const response = await fetch(workflowDispatchUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${EnsureToken()}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log(`Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`Response error text:`, errorText);
                
                // Provide helpful error message for common issues
                if (response.status === 422) {
                    messageTextElement.innerHTML += `<br>[Error]: Failed to trigger workflow in ${targetRepoOwner}/${targetRepoName}.<br>`;
                    messageTextElement.innerHTML += `[Info]: The workflow file <code>${workflowFileName}</code> may not exist in the repository or it doesn't have the <code>workflow_dispatch</code> trigger configured.<br>`;
                    messageTextElement.innerHTML += `[Info]: Please ensure:<br>`;
                    messageTextElement.innerHTML += `1. The repository <a href="https://github.com/${targetRepoOwner}/${targetRepoName}" target="_blank">${targetRepoOwner}/${targetRepoName}</a> has the workflow file <code>.github/workflows/${workflowFileName}</code><br>`;
                    messageTextElement.innerHTML += `2. The workflow file contains <code>workflow_dispatch:</code> in the <code>on:</code> section<br>`;
                    messageTextElement.innerHTML += `3. GitHub Actions is enabled in the repository settings<br>`;
                    return;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            messageTextElement.innerHTML += `[Log]: Workflow ${workflowFileName} triggered successfully!<br>`;
            //messageTextElement.innerHTML += `[Log]: Source PR: ${sourcePRURL}<br>`;
            //messageTextElement.innerHTML += `[Log]: Target PR: ${targetPRURL}<br>`;

            // Provide direct link to the workflow page where user can check the status
            const workflowPageUrl = `https://github.com/${targetRepoOwner}/${targetRepoName}/actions/workflows/${workflowFileName}`;
            messageTextElement.innerHTML += `[Log]: Check workflow status at: <a href="${workflowPageUrl}" target="_blank">${workflowPageUrl}</a><br>`;
            messageTextElement.innerHTML += `[Info]: To monitor the translation progress, check the preceding workflow page. After the workflow completes successfully, the translation result will be automatically applied to the target PR.<br>`;

            console.log(`Workflow ${workflowFileName} triggered successfully in ${targetRepoOwner}/${targetRepoName}`);

        } catch (error) {
            messageTextElement.innerHTML += `<br>[Error]: Failed to trigger workflow: ${error.message}<br>`;
            console.error(`Failed to trigger workflow:`, error);
        }
    }

    async function CreateTransPR(triggerWorkflow = true) {
        try {
            const messageBox = document.createElement("div");
            messageBox.style.position = "fixed";
            messageBox.style.top = "50%";
            messageBox.style.left = "50%";
            messageBox.style.transform = "translate(-50%, -50%)";
            messageBox.style.padding = "30px";
            messageBox.style.backgroundColor = "white";
            messageBox.style.border = "1px solid #e1e4e8";
            messageBox.style.borderRadius = "6px";
            messageBox.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.1)";
            messageBox.style.zIndex = "9999";
            messageBox.style.width = "480px";
            messageBox.style.minHeight = "300px";
            messageBox.style.maxHeight = "80vh";
            messageBox.style.overflow = "auto";
            messageBox.style.marginTop = "10px";
            document.body.appendChild(messageBox);

            const messageTextElement = document.createElement("span");
            messageTextElement.innerHTML = `Start creating an empty translation PR for you.<br>Wait for a few seconds....<br><br>`;
            messageTextElement.style.fontSize = "14px";
            messageTextElement.style.color = "#24292e";
            messageTextElement.style.marginBottom = "10px";
            messageBox.appendChild(messageTextElement);

            const closeButton = document.createElement("span");
            closeButton.innerText = "X";
            closeButton.style.position = "absolute";
            closeButton.style.top = "8px";
            closeButton.style.right = "10px";
            closeButton.style.right = "8px";
            closeButton.style.fontSize = "12px";
            closeButton.style.fontWeight = "bold";
            closeButton.style.color = "#586069";
            closeButton.style.border = "none";
            closeButton.style.backgroundColor = "transparent";
            closeButton.style.cursor = "pointer";
            closeButton.addEventListener("click", () => {
                messageBox.style.display = "none";
            });
            messageBox.appendChild(closeButton);

            // Show the message box
            messageBox.style.display = "block";

            const octokit = new Octokit({ auth: EnsureToken() });
            console.log(octokit);
            // TODO: Define a new function to parse the current URL and return the repo owner, repo name, PR number, etc.
            const currentURL = window.location.pathname;
            const currentURLSplit = currentURL.split("/");
            const currentRepoOwner = currentURLSplit[1];
            const currentRepoName = currentURLSplit[2];
            const currentPRNumber = currentURLSplit[4];
            const targetRepoOwner = TARGET_REPO_OWNER
            let myRepoName, targetRepoName, translationLabel;
            switch (currentRepoName) {
                case "docs-cn":
                    myRepoName = "docs";
                    targetRepoName = "docs";
                    translationLabel = "translation/from-docs-cn";
                    break;
                case "docs":
                    myRepoName = "docs-cn";
                    targetRepoName = "docs-cn";
                    translationLabel = "translation/from-docs";
                    break;
            }

            //1.Get the GitHub login name of the current user
            const myRepoOwner = await GetMyGitHubID();
            //2.Get the source PR information
            const [sourceTitle, sourceDescription, sourceLabels, baseRepo, baseBranch, headRepo, headBranch] = await GetPRInfo(octokit, messageTextElement, currentRepoOwner, currentRepoName, currentPRNumber);
            const excludeLabels = ["size", "translation", "status", "first-time-contributor", "contribution", "lgtm", "approved"];
            const targetLabels = sourceLabels.filter(label => !excludeLabels.some(excludeLabel => label.includes(excludeLabel)));

            if (!sourceLabels.includes("translation/done")) {
                // Proceed with the PR creation only if the translation/done label is not added for the current source PR
                //3. Sync the base branch of my forked repository
                await SyncMyRepoBranch(octokit, messageTextElement, targetRepoOwner, targetRepoName, myRepoOwner, myRepoName, baseBranch);
                //4. Create a new branch in the repository that I forked
                const newBranchName = `${headBranch}-${currentPRNumber}`;
                await CreateBranch(octokit, messageTextElement, myRepoOwner, myRepoName, newBranchName, baseBranch);
                //5. Create a temporary temp.md file in the new branch
                const filePath = "temp.md";
                const FileContent = "This is a test file.";
                const CommitMessage = "Add temp.md";
                await CreateFileInBranch(octokit, messageTextElement, myRepoOwner, myRepoName, newBranchName, filePath, FileContent, CommitMessage);
                //6. Create a pull request
                const title = sourceTitle;
                const body = UpdatePRDescription(currentRepoOwner, currentRepoName, currentPRNumber, sourceDescription, targetRepoName);
                targetLabels.push(translationLabel);
                const labels = targetLabels;
                const targetPRURL = await CreatePullRequest(octokit, messageTextElement, targetRepoOwner, targetRepoName, baseBranch, myRepoOwner, myRepoName, newBranchName, title, body, labels);
                //7. Delete the temporary temp.md file
                const CommitMessage2 = "Delete temp.md";
                await DeleteFileInBranch(octokit, myRepoOwner, myRepoName, newBranchName, filePath, CommitMessage2);
                //8. Trigger the workflow in the forked repository (only if triggerWorkflow is true)
                if (triggerWorkflow) {
                    const sourcePRURL = `https://github.com/${currentRepoOwner}/${currentRepoName}/pull/${currentPRNumber}`;
                    await TriggerWorkflow(octokit, messageTextElement, myRepoOwner, myRepoName, baseBranch, sourcePRURL, targetPRURL);
                } else {
                    messageTextElement.innerHTML += `<br>[Info]: Translation PR created successfully without triggering the workflow.<br>`;
                }
            }
            else {
                messageTextElement.innerHTML += `<br>[Error]: The current PR already has the <b>translation/done</b> label, which means that there is already a translation PR for it. Please check if you still need to create another translation PR. If yes, you need to change the <b>translation/done</b> label to <b>translation/doing</b> first.<br>`;
            }
        } catch (error) {
            console.error("An error occurred:", error);
            return error;
        }
    }

    // TODO: Use toggle instead of button, and add more features to the toggle, e.g., editing tokens.
    function EnsureCommentButton() {
        const MARK = 'comment-button'
        if (document.querySelector(`button[${ATTR}="${MARK}"]`)) {
            return;
        }
        // First, find the "table-list-header-toggle" div
        var toggleDiv = document.querySelector('.table-list-header-toggle.float-right');

        if (!toggleDiv) {
            return;
        }
        // Next, create a button element and add it to the page
        var button = document.createElement('button');
        button.innerHTML = 'Comment';
        button.setAttribute('class', 'btn btn-sm js-details-target d-inline-block float-left float-none m-0 mr-md-0 js-title-edit-button');
        button.setAttribute(ATTR, MARK);
        toggleDiv.appendChild(button);

        // Next, add an event listener to the button to listen for clicks
        button.addEventListener('click', function () {
            EnsureToken();

            // Get a list of all the checkboxes on the page (these are used to select PRs)
            var checkboxes = document.querySelectorAll('input[type=checkbox][data-check-all-item]');

            // Iterate through the checkboxes and get the ones that are checked
            var selectedPRs = [];

            checkboxes.forEach(function (checkbox) {
                if (checkbox.checked) {
                    selectedPRs.push(checkbox.value);
                }
            })

            // Prompt the user for a comment to leave on the selected PRs
            var comment = prompt('Enter a comment to leave on the selected PRs:');
            if (!comment) {
                return;
            }
            var repo = GetRepositoryInformation();

            // Leave the comment on each selected PR
            selectedPRs.forEach(function (pr) {
                var commentLink = `https://api.github.com/repos/${repo.owner}/${repo.name}/issues/${pr}/comments`;
                // Leave a comment on the PR
                LeaveCommentOnPR(commentLink, comment);
            });
        });
    }

    function EnsureCommentButtonOnPR() {
        const MARK = "comment-button-pr";
        if (document.querySelector(`button[${ATTR}="${MARK}"]`)) {
            return;
        }
        // First, find the "table-list-header-toggle" div
        var headerActions = document.querySelector(".gh-header-actions");

        if (!headerActions) {
            return;
        }

        // Next, create a button element and add it to the page
        var button = document.createElement("button");
        button.innerHTML = "Comment";
        button.setAttribute(
            "class",
            "flex-md-order-2 Button--secondary Button--small Button m-0 mr-md-0"
        );
        button.setAttribute(ATTR, MARK);
        headerActions.appendChild(button);

        // Next, add an event listener to the button to listen for clicks
        button.addEventListener("click", function () {
            EnsureToken();

            // get the pr number
            const url = window.location.pathname;
            const urlSplit = url.split("/");
            const index = urlSplit.indexOf("pull");
            const pr = urlSplit[index + 1];

            // Prompt the user for a comment to leave on the selected PRs
            var comment = prompt("Enter a comment to leave on the selected PRs:");
            if (!comment) {
              return;
            }
            var repo = GetRepositoryInformation();

            // Leave the comment on this PR
            var commentLink = `https://api.github.com/repos/${repo.owner}/${repo.name}/issues/${pr}/comments`;
            LeaveCommentOnPR(commentLink, comment);
        });
    }

    function EnsureFileLink(issueElement) {
        const MARK = 'file-link-span'

        if (issueElement.querySelector(`span[${ATTR}="${MARK}"]`)) {
            return; // Already added
        }

        var issueId = issueElement.getAttribute("id")
        var originalLinkElement = document.getElementById(issueId + "_link")
        if (!originalLinkElement) {
            return; // Element is not ready
        }

        var originalLink = originalLinkElement.getAttribute("href")
        var newLink = originalLink + "/files"

        var openedByElement = issueElement.querySelectorAll('span[class="opened-by"]');
        if (openedByElement.length == 1) {
            var openedBy = openedByElement[0];
            var linkSpanElement = document.createElement('span');
            linkSpanElement.setAttribute('class', 'd-inline-block mr-1 custom')
            linkSpanElement.setAttribute(ATTR, MARK)
            var dotSpanElement = document.createElement('span');
            dotSpanElement.innerHTML = ' • ';
            dotSpanElement.setAttribute('class', 'd-inline-block mr-1 custom')
            var linkElement = document.createElement('a')
            linkElement.setAttribute('href', newLink)
            linkElement.setAttribute('class', 'Link--muted')
            linkElement.innerHTML = "Files"
            linkSpanElement.appendChild(linkElement)
            openedBy.insertAdjacentElement('beforebegin', linkSpanElement)
            openedBy.insertAdjacentElement('beforebegin', dotSpanElement);
        }
    }

    // This function creates a button that scrolls to top of the page
    function EnsureScrollToTopButton() {
        const MARK = 'scroll-to-top-button';

        if (document.querySelector(`button[${ATTR}="${MARK}"]`)) {
            return;
        }

        // create the button
        var button = document.createElement('button');
        button.innerHTML = '&uarr;';

        // set position and style for the button
        button.style.position = "fixed";
        button.style.bottom = "55px";
        button.style.right = "20px";
        button.style.zIndex = "999"; // always on top
        button.style.width = "30px";
        button.style.display = "none"; // initially hidden
        button.className = "js-details-target js-title-edit-button flex-md-order-2 Button--secondary Button--small Button m-0 mr-md-0";

        // trigger scrolling to top when button is clicked
        button.addEventListener('click', function () {
            window.scrollTo(0, 0);
        });

        // add the button to the page
        document.body.appendChild(button);

        // show the button only when not at the top
        window.addEventListener("scroll", function() {
            if (window.pageYOffset > 0) {
              button.style.display = "block";
            } else {
              button.style.display = "none";
            }
          });
    }

    // This function creates a button that scrolls to bottom of the page
    function EnsureScrollToBottomButton() {
        const MARK = 'scroll-to-bottom-button';

        if (document.querySelector(`button[${ATTR}="${MARK}"]`)) {
          return;
        }

        // create the button
        var button = document.createElement('button');
        button.innerHTML = '&darr;';

        // set position and style for the button
        button.style.position = "fixed";
        button.style.bottom = "20px";
        button.style.right = "20px";
        button.style.zIndex = "999"; // always on top
        button.style.width = "30px";
        button.className = "js-details-target js-title-edit-button flex-md-order-2 Button--secondary Button--small Button m-0 mr-md-0";

        // trigger scrolling to bottom when button is clicked
        button.addEventListener('click', function () {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // add the button to the page
        document.body.appendChild(button);

        // show the button only when not at the bottom
        window.addEventListener("scroll", function() {
          if (window.pageYOffset + window.innerHeight < document.body.scrollHeight) {
            button.style.display = "block";
          } else {
            button.style.display = "none";
          }
        });
      }

      function EnsureCreateTransPRButtonOnPR() {
        const MARK = 'create-trans-pr-button';

        // Check if the button already exists
        if (document.querySelector(`div[${ATTR}="${MARK}"]`)) {
          return;
        }

        // Find the header actions container
        var headerActions = document.querySelector(".gh-header-actions");

        if (!headerActions) {
          return;
        }

        // Create a container for the dropdown
        var dropdownContainer = document.createElement("div");
        dropdownContainer.setAttribute("class", "flex-md-order-2 position-relative");
        dropdownContainer.setAttribute(ATTR, MARK);
        dropdownContainer.style.display = "inline-block";

        // Create the main button
        var button = document.createElement("button");
        button.innerHTML = 'Create Translation PR <span class="Button-visual Button-trailingAction" style="margin-left: 4px;"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-down"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path></svg></span>';
        button.setAttribute(
          "class",
          "Button--secondary Button--small Button m-0"
        );
        button.style.cursor = "pointer";

        // Create the dropdown menu
        var dropdownMenu = document.createElement("div");
        dropdownMenu.style.display = "none";
        dropdownMenu.style.position = "absolute";
        dropdownMenu.style.right = "0";
        dropdownMenu.style.top = "100%";
        dropdownMenu.style.marginTop = "4px";
        dropdownMenu.style.backgroundColor = "white";
        dropdownMenu.style.border = "1px solid #d0d7de";
        dropdownMenu.style.borderRadius = "6px";
        dropdownMenu.style.boxShadow = "0 8px 24px rgba(140,149,159,0.2)";
        dropdownMenu.style.zIndex = "1000";
        dropdownMenu.style.minWidth = "200px";
        dropdownMenu.style.padding = "4px 0";

        // Create first option: Create Synced Translation PR
        var syncedOption = document.createElement("div");
        syncedOption.innerHTML = "Create Synced Translation PR";
        syncedOption.style.padding = "8px 16px";
        syncedOption.style.cursor = "pointer";
        syncedOption.style.fontSize = "14px";
        syncedOption.style.color = "#24292e";
        syncedOption.style.whiteSpace = "nowrap";
        syncedOption.addEventListener("mouseenter", function() {
          syncedOption.style.backgroundColor = "#f6f8fa";
        });
        syncedOption.addEventListener("mouseleave", function() {
          syncedOption.style.backgroundColor = "white";
        });
        syncedOption.addEventListener("click", function(e) {
          e.stopPropagation();
          dropdownMenu.style.display = "none";
          EnsureToken();
          CreateTransPR(true); // Create PR and trigger workflow
        });

        // Create second option: Create Empty Translation PR
        var emptyOption = document.createElement("div");
        emptyOption.innerHTML = "Create Empty Translation PR";
        emptyOption.style.padding = "8px 16px";
        emptyOption.style.cursor = "pointer";
        emptyOption.style.fontSize = "14px";
        emptyOption.style.color = "#24292e";
        emptyOption.style.whiteSpace = "nowrap";
        emptyOption.addEventListener("mouseenter", function() {
          emptyOption.style.backgroundColor = "#f6f8fa";
        });
        emptyOption.addEventListener("mouseleave", function() {
          emptyOption.style.backgroundColor = "white";
        });
        emptyOption.addEventListener("click", function(e) {
          e.stopPropagation();
          dropdownMenu.style.display = "none";
          EnsureToken();
          CreateTransPR(false); // Create PR without triggering workflow
        });

        // Append options to dropdown menu
        dropdownMenu.appendChild(syncedOption);
        dropdownMenu.appendChild(emptyOption);

        // Toggle dropdown menu on button click
        button.addEventListener("click", function(e) {
          e.stopPropagation();
          if (dropdownMenu.style.display === "none") {
            dropdownMenu.style.display = "block";
          } else {
            dropdownMenu.style.display = "none";
          }
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", function(e) {
          if (!dropdownContainer.contains(e.target)) {
            dropdownMenu.style.display = "none";
          }
        });

        // Append button and dropdown to container
        dropdownContainer.appendChild(button);
        dropdownContainer.appendChild(dropdownMenu);

        // Append container to header actions
        headerActions.appendChild(dropdownContainer);
      }

    function Init() {

        const url = window.location.href;

        // If we are on the PR list page, add the comment button and file link
        if (url.includes('/pulls')) {
            const observer = new MutationObserver(() => {
                document.querySelectorAll('div[id^="issue_"]').forEach((element) => {
                    EnsureFileLink(element);
                })
                EnsureCommentButton();
            });
            const config = { childList: true, subtree: true };
            observer.observe(document, config);
        }

        // If we are on the PR details page, add the scroll to top and bottom buttons
        if (url.includes('/pull/')) {
            EnsureScrollToTopButton();
            EnsureScrollToBottomButton();
            EnsureCommentButtonOnPR();

            const observer = new MutationObserver(() => {
                EnsureCommentButtonOnPR();
            });
            const targetNode = document.body;
            const observerOptions = { childList: true, subtree: true };
            observer.observe(targetNode, observerOptions);

            // If we are on the PR details page of pingcap/docs-cn or pingcap/docs, add the CreateTranslationPR button
            if (url.includes(`${TARGET_REPO_OWNER}/docs-cn/pull`) || url.includes(`${TARGET_REPO_OWNER}/docs/pull`)) {
                EnsureCreateTransPRButtonOnPR();
                const observerCreateTransPR = new MutationObserver(() => {
                    EnsureCreateTransPRButtonOnPR();
                });
                observerCreateTransPR.observe(targetNode, observerOptions);
            }

        }
    }

    Init();
})();
