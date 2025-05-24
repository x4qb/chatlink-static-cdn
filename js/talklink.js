const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const targetText = document.getElementById("targetId");

const target = params.get('target');

targetText.textContent = target;
