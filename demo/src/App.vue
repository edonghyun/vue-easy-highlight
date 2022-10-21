<template>
    <div class="container-fluid">
        <TheHeader />
        <div class="row title">
            <div class="text-center">
                <h1>Vue Easy Highlight</h1>
            </div>
        </div>
        <div class="row content">
            <div class="col-12 col-md-6 p-0 m-0">
                <div class="component-wrapper">
                    <EasyHighlight
                        :key="renderKey"
                        :text="options.text"
                        :textsToHighlight="options.textsToHighlight"
                        :highlightColors="options.highlightColors"
                        :selectedTextColor="options.selectedTextColor"
                        :selectedTextBackgroundColor="
                            options.selectedTextBackgroundColor
                        "
                    />
                </div>
            </div>
            <div class="col-md-6 col-12 p-0 m-0">
                <div class="component-wrapper">
                    <div class="options-form-container">
                        <div class="form-group col-12 mb-3">
                            <label for="inputEmail4" class="mb-2">
                                <h6>TextsToHighlight</h6>
                            </label>

                            <div>
                                <div
                                    v-for="textToHighlight in options.textsToHighlight"
                                    :key="textToHighlight"
                                    class="row p-3 text-to-highlight-container"
                                >
                                    <div
                                        class="col-12 col-md-11 d-flex align-items-center"
                                    >
                                        {{ textToHighlight }}
                                    </div>
                                    <div
                                        class="col-md-1 d-flex justify-content-end"
                                        @click="
                                            deleteTextToHighlight(
                                                textToHighlight,
                                            )
                                        "
                                    >
                                        <button
                                            type="button"
                                            class="btn btn-outline-secondary"
                                        >
                                            delete
                                        </button>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-12 col-md-12 col-lg-10">
                                        <input
                                            v-model="textToHighlight"
                                            type="text"
                                            class="form-control w-100"
                                            @keyup.enter="addTextToHighlight"
                                        />
                                    </div>
                                    <div
                                        class="input-group-append col-12 col-md-12 col-lg-2 d-flex justify-content-end"
                                    >
                                        <button
                                            @click="addTextToHighlight"
                                            class="btn btn-outline-secondary btn-block w-100"
                                            type="button"
                                        >
                                            add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group col-12 mb-3">
                            <label for="inputEmail4" class="mb-2">
                                <h6>HiglightColor</h6>
                            </label>
                            <input
                                v-model="options.higlightColor"
                                type="color"
                                class="form-control"
                                aria-label="higlightColor"
                            />
                        </div>
                        <div class="form-group col-12 mb-3">
                            <label for="inputEmail4" class="mb-2">
                                <h6>Selected Text Color</h6>
                            </label>
                            <input
                                v-model="options.selectedTextColor"
                                type="color"
                                class="form-control"
                                aria-label="selectedTextColor"
                            />
                        </div>
                        <div class="form-group col-12 mb-3">
                            <label for="inputEmail4" class="mb-2">
                                <h6>Selected Text Background Color</h6>
                            </label>
                            <input
                                v-model="options.selectedTextBackgroundColor"
                                type="color"
                                class="form-control"
                                aria-label="selectedTextBackgroundColor"
                            />
                        </div>
                        <div class="form-group col-12 mb-3">
                            <label for="inputEmail4" class="mb-2">
                                <h6>Text</h6>
                            </label>
                            <textarea
                                class="form-control"
                                aria-label="With textarea"
                                v-model="options.text"
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { reactive, ref, watch } from 'vue';
import TheHeader from './TheHeader.vue';
import EasyHighlight from '../../src/EasyHighlight.vue';

const text = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.
Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`;

const higlightColor = '#87cefa';

const highlightColors = [
    '#E8D9FF',
    '#D1B2FF',
    '#A566FF',
    '#8041D9',
    '#3F0099',
    '#2A0066',
];

const textsToHighlight = new Set([
    'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the in',
    'text of the printing and typesetting industry. Lorem',
    'printing and typesetting',
    'printing',
]);

const selectedTextColor = '#000000';

const selectedTextBackgroundColor = '#dddddd';

export default {
    name: 'App',
    components: {
        TheHeader,
        EasyHighlight,
    },
    setup() {
        const renderKey = ref(0);
        const textToHighlight = ref('');
        const options = reactive({
            text,
            higlightColor,
            highlightColors,
            textsToHighlight,
            selectedTextColor,
            selectedTextBackgroundColor,
        });

        function deleteTextToHighlight(textToHighlight) {
            options.textsToHighlight.delete(textToHighlight);
        }

        function addTextToHighlight() {
            if (textToHighlight.value.length < 1) {
                return alert('Empty string is input');
            }

            options.textsToHighlight.add(textToHighlight.value);
            textToHighlight.value = '';
        }

        watch(
            () => [
                options.selectedTextColor,
                options.selectedTextBackgroundColor,
            ],
            () => {
                renderKey.value += 1;
            },
            {
                deep: true,
            },
        );

        return {
            renderKey,
            options,
            textToHighlight,
            deleteTextToHighlight,
            addTextToHighlight,
        };
    },
};
</script>

<style lang="scss">
@import 'assets/scss/style';
</style>
