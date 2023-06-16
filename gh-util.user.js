// ==UserScript==
// @name         Octopus GitHub
// @version      0.9
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
    function GetPRInfo(octokit, messageTextElement, repoOwner, repoName, PRNumber) {
        return new Promise((resolve, reject) => {
            octokit.pullRequests.get({
                owner: repoOwner,
                repo: repoName,
                number: PRNumber,
            })
                .then(response => {
                const PRData = response.data;
                const sourceTitle = PRData.title;
                const SourceDescription = PRData.body;
                const sourceLabels = PRData.labels.map(label => label.name);
                const BaseRepo = PRData.base.repo.full_name;
                const baseBranch = PRData.base.ref;
                // const headRepo = PRData.head.repo.full_name;
                const headBranch = PRData.head.ref;

                messageTextElement.innerHTML += `[Log]: Getting the source language PR information...<br>`;
                console.log(`Getting source language PR information was successful. The head branch name is: ${headBranch}`);

                const result = [sourceTitle, SourceDescription, sourceLabels, BaseRepo, baseBranch, headBranch];
                resolve(result);
            })
                .catch(error => {
                messageTextElement.innerHTML += `<br>[Error]: Failed to get the source language PR information: ${error.message}`;
                reject(error);
            });
        });
    }

    // This function can be used to sync the latest content from the upstream branch to your own branch
     async function SyncMyRepoBranch(octokit, messageTextElement, sourceRepoOwner, sourceRepoName, targetRepoOwner, targetRepoName, baseBranch) {
         try {
             const upstreamRef = await octokit.gitdata.getReference({
                 owner: sourceRepoOwner,
                 repo: sourceRepoName,
                 ref: `heads/${baseBranch}`
             });

             const upstreamSHA = upstreamRef.data.object.sha;
             console.log(upstreamSHA);

             messageTextElement.innerHTML += `[Log]: Syncing the latest content from the upstream branch...<br>`;
             await octokit.gitdata.updateReference({
                 owner: targetRepoOwner,
                 repo: targetRepoName,
                 ref: `heads/${baseBranch}`,
                 sha: upstreamSHA,
                 force: true,
                 headers: {'Authorization': `Bearer ${EnsureToken()}`}
             });
             console.log("The content sync is successful!");
         } catch (error) {
             messageTextElement.innerHTML += `<br>[Error]: Failed to sync the latest content from the upstream branch to your branch. Please check whether you have forked the ${sourceRepoOwner}/${sourceRepoName} repo with all its branches.<br>`;
             console.log(error);
             throw error;
         }
    };

    // This function can be used to create a new branch in your repo
    async function CreateBranch(octokit, messageTextElement, repoOwner, repoName, branchName, baseBranch) {
        try {
            const baseRef = await octokit.gitdata.getReference({
                owner: repoOwner,
                repo: repoName,
                ref: `heads/${baseBranch}`
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
    function UpdatePRDescription(sourcePRURL, sourceDescription, sourceRepo, targetRepo) {
        const sourcePRCLA = "https://cla-assistant.io/pingcap/" + sourceRepo;
        const newPRCLA = "https://cla-assistant.io/pingcap/" + targetRepo;
        let newPRDescription = sourceDescription.replace(sourcePRCLA, newPRCLA);

        newPRDescription = newPRDescription.replace("This PR is translated from:", "This PR is translated from: " + sourcePRURL);

        if (sourceDescription.includes("tips for choosing the affected versions")) {
            newPRDescription = newPRDescription.replace(/.*?\[tips for choosing the affected version.*?\n\n?/, "");
        }

        return newPRDescription;
    }

    // This function can be used to create a pull request based on your specified branch
    async function CreatePullRequest(octokit, messageTextElement, repoOwner, repoName, baseBranch, headRepoOwner, headBranchName, title, body, labels) {
        try {
            messageTextElement.innerHTML += `[Log]: Creating the empty translation PR...<br>`;
            const prResponse = await octokit.pullRequests.create({
                owner: repoOwner,
                repo: repoName,
                title: title,
                body: body,
                head: `${headRepoOwner}:${headBranchName}`,
                base: baseBranch,
                headers: {'Authorization': `Bearer ${EnsureToken()}`}
            });

            try {
                console.log(prResponse);
                const prUrl = prResponse.data.html_url;
                //console.log(`Your target PR is created successfully. The PR address is: ${prUrl}`);
                messageTextElement.innerHTML += `<br> Your target PR is created successfully. <br> The PR address is:<br> <a href="${prUrl}" target="_blank">${prUrl}</a>`;
                const urlParts = prUrl.split("/");
                const targetPRNumber = urlParts[6];

                // Add labels to the created PR
                await octokit.issues.addLabels({
                    owner: repoOwner,
                    repo: repoName,
                    number: targetPRNumber,
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
                ref: branchName
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

    async function CreateTransPR() {
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
            messageBox.style.width = "430px";
            messageBox.style.height = "300px";
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
<<<<<<< Updated upstream
            const SourcePRURL = window.location.href;
=======
            const currentURL = window.location.pathname;
            const currentURLSplit = currentURL.split("/");
            const sourceRepoOwner = currentURLSplit[1];
>>>>>>> Stashed changes
            const targetRepoOwner = "pingcap";
            if (sourceRepoOwner != "pingcap") {
                console.error('Error: The create translation PR feature is only available for pingcap/docs-cn and pingcap/docs.');
            }
            if (currentURLSplit[3] != "pull") {
                console.error('Error: The create translation PR feature is only available for PRs');
            }
            const sourcePRNumber = currentURLSplit[4];
            const sourceRepoName = currentURLSplit[2];
            let forkRepoName, targetRepoName, translationLabel;
            if (sourceRepoName == "docs-cn") {
                forkRepoName = "docs";
                targetRepoName = "docs";
                translationLabel = "translation/from-docs-cn";
            } else if (sourceRepoName == "docs") {
                forkRepoName = "docs-cn";
                targetRepoName = "docs-cn";
                translationLabel = "translation/from-docs";
            } else {
                console.error('Error: The create translation PR feature is only available for pingcap/docs-cn and pingcap/docs.')
            }

            //1.Get the GitHub login name of the current user
            const myRepoOwner = await GetMyGitHubID();
            //2.Get the source PR information
            const [sourceTitle, SourceDescription, sourceLabels, BaseRepo, baseBranch, headBranch] = await GetPRInfo(octokit, messageTextElement, sourceRepoOwner, sourceRepoName, sourcePRNumber);
            const excludeLabels = ["size", "translation", "status", "first-time-contributor", "contribution", "lgtm", "approved"];
            const targetLabels = sourceLabels.filter(label => !excludeLabels.some(excludeLabel => label.includes(excludeLabel)));

            if (!sourceLabels.includes("translation/done")) {
                // Proceed with the PR creation only if the translation/done label is not added for the current source PR
                //3.Create a new branch in the repository that I forked
                await SyncMyRepoBranch(octokit, messageTextElement, targetRepoOwner, targetRepoName, myRepoOwner, forkRepoName, baseBranch);
                const newBranchName = `${headBranch}-${sourcePRNumber}`;
                await CreateBranch(octokit, messageTextElement, myRepoOwner, forkRepoName, newBranchName, baseBranch);
                //4. Create a temporary temp.md file in the new branch
                const filePath = "temp.md";
                const FileContent = "This is a test file.";
                const CommitMessage = "Add temp.md";
                await CreateFileInBranch(octokit, messageTextElement, myRepoOwner, forkRepoName, newBranchName, filePath, FileContent, CommitMessage);
                // 5. Create a pull request
                const title = sourceTitle;
                const SourcePRURL = `https://github.com/${sourceRepoOwner}/${sourceRepoName}/pull/${sourcePRNumber}`;
                const body = UpdatePRDescription(SourcePRURL, SourceDescription, BaseRepo, targetRepoName);
                targetLabels.push(translationLabel);
                const labels = targetLabels;
                await CreatePullRequest(octokit, messageTextElement, targetRepoOwner, targetRepoName, baseBranch, myRepoOwner, newBranchName, title, body, labels);
                // 6. Delete the temporary temp.md file
                const CommitMessage2 = "Delete temp.md";
                await DeleteFileInBranch(octokit, myRepoOwner, forkRepoName, newBranchName, filePath, CommitMessage2);
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
        if (document.querySelector(`button[${ATTR}="${MARK}"]`)) {
          return;
        }

        // Find the header actions container
        var headerActions = document.querySelector(".gh-header-actions");

        if (!headerActions) {
          return;
        }

        // Create a button element
        var button = document.createElement("button");
        button.innerHTML = "Create Translation PR";
        button.setAttribute(
          "class",
          "flex-md-order-2 Button--secondary Button--small Button m-0 mr-md-0"
        );
        button.setAttribute(ATTR, MARK);
        headerActions.appendChild(button);

        // Add event listener to the button
        button.addEventListener("click", function () {
          // Call the function to create translation PR
          EnsureToken();
          CreateTransPR();
        });
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
            if (url.includes('pingcap/docs-cn/pull') || url.includes('pingcap/docs/pull')) {
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
