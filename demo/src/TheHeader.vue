<template>
    <div class="row header">
        <div class="col-12 d-flex justify-content-center">
            <div class="d-flex menu">Home</div>
            <div class="d-flex menu">Get Started</div>
            <div class="d-flex menu">API</div>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref } from 'vue';

export default defineComponent({
    name: 'TheHeader',
    setup() {
        const gitHubRepositoryApiUrl =
            'https://api.github.com/repos/edonghyun/vue-easy-highlight';
        const gitHubRepositoryUrl =
            'https://github.com/edonghyun/vue-easy-highlight';
        const gitHubStarGazersUrl = ref('');
        const gitHubStarGazersCount = ref(0);

        (async function onCreated() {
            const response = await fetch(gitHubRepositoryApiUrl);
            const data = await response.json();

            gitHubStarGazersUrl.value = data.stargazers_url;
            gitHubStarGazersCount.value = data.stargazers_count;
        })();

        return {
            gitHubRepositoryUrl,
            gitHubStarGazersUrl,
            gitHubStarGazersCount,
        };
    },
});
</script>
