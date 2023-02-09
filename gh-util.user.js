// ==UserScript==
// @name         Octopus GitHub
// @version      0.1
// @description  A userscript for GitHub
// @author       Oreo
// @match        https://github.com/*/pulls*
// @grant        none
// ==/UserScript==

(function () {

    'use strict';

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

    function CreateFileLink() {

        // Get all div elements with an id that starts with "issue_"
        var issueElements = document.querySelectorAll('div[id^="issue_"]');
        issueElements.forEach((element) => {
            var issueId = element.getAttribute("id")
            var originalLinkElement = document.getElementById(issueId + "_link")
            var originalLink = originalLinkElement.getAttribute("href")
            var newLink = originalLink + "/files"
            // Get all span elements within the current element
            var spanElements = element.querySelectorAll('span[class="opened-by"]');
            if (spanElements.length == 1) {
                var openedBy = spanElements[0];
                var linkSpanElement = document.createElement('span');
                linkSpanElement.setAttribute('class', 'd-inline-block mr-1')
                var dotSpanElement = document.createElement('span');
                dotSpanElement.innerHTML = ' • ';
                dotSpanElement.setAttribute('class', 'd-inline-block mr-1')
                var linkElement = document.createElement('a')
                linkElement.setAttribute('href', newLink)
                linkElement.setAttribute('class', 'Link--muted')
                linkElement.innerHTML = "Files"
                linkSpanElement.appendChild(linkElement)
                openedBy.insertAdjacentElement('beforebegin', linkSpanElement)
                openedBy.insertAdjacentElement('beforebegin', dotSpanElement);
            }
        })

    }

    CreateFileLink();

})();