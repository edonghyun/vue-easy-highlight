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
                        :text="options.text"
                        :textsToHighlight="options.textsToHighlight"
                        :higlightColor="options.higlightColor"
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
                                    <div class="col-12 col-md-11">
                                        <input
                                            v-model="textToHighlight"
                                            type="text"
                                            class="form-control w-100"
                                            aria-describedby="basic-addon2"
                                            @keyup.enter="addTextToHighlight"
                                        />
                                    </div>
                                    <div
                                        class="input-group-append col-12 col-md-1 d-flex justify-content-end"
                                    >
                                        <button
                                            @click="addTextToHighlight"
                                            class="btn btn-outline-secondary btn-block"
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
                                aria-describedby="basic-addon1"
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
import { defineComponent, reactive, ref } from 'vue';
import TheHeader from './TheHeader.vue';
import EasyHighlight from '../../src/EasyHighlight.vue';

const text = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`;

const higlightColor = '#87cefa';

const textsToHighlight = new Set(['unknown printer took a galley']);

export default defineComponent({
    name: 'App',
    components: {
        TheHeader,
        EasyHighlight,
    },
    setup() {
        const textToHighlight = ref('');
        const options = reactive({
            text,
            higlightColor,
            textsToHighlight,
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

        return {
            options,
            textToHighlight,
            deleteTextToHighlight,
            addTextToHighlight,
        };
    },
});
</script>

<style lang="scss">
@import 'assets/scss/style';
</style>
