<script>
import { computed } from 'vue';
import {
    DEFAULT_HIGHLIGHT_COLOR,
    DEFAULT_SELECTED_BACKGROUND_COLOR,
    DEFAULT_SELECTED_COLOR,
    BASE_CHARACTER_ID,
} from './config';
import HighlightedText from './HighlightedText';

function getPlainText(textData) {
    return textData.replace(/\s/g, '');
}

export default {
    name: 'EasyHighlight',
    components: {
        HighlightedText,
    },
    emits: ['text:selected', 'text:clicked'],
    props: {
        text: {
            type: String,
            required: true,
        },
        textsToHighlight: {
            type: Set,
            required: true,
        },
        baseColor: {
            type: String,
            default: () => DEFAULT_HIGHLIGHT_COLOR,
        },
        textsBaseColorMap: {
            type: Object,
            default: () => ({}),
        },
        selectedTextColor: {
            type: String,
            default: () => DEFAULT_SELECTED_COLOR,
        },
        selectedTextBackgroundColor: {
            type: String,
            default: () => DEFAULT_SELECTED_BACKGROUND_COLOR,
        },
    },
    setup(props, context) {
        const selectionColors = computed(() => ({
            '--selected-color': props.selectedTextColor,
            '--selected-background-color': props.selectedTextBackgroundColor,
        }));

        const baseColorsIndexesMap = computed(() => {
            const map = {};
            for (let i = 0; i < props.text.length; i++) {
                map[i] = props.baseColor;
            }

            Object.entries(props.textsBaseColorMap).map(
                ([textToSearch, color]) => {
                    const escapedTextToSearch = getEscapedText(textToSearch);
                    const textIndices = getAllTextIndices(
                        props.text,
                        escapedTextToSearch,
                    );

                    textIndices.forEach((i) => {
                        for (let j = 0; j < textToSearch.length; j++) {
                            map[i + j] = color;
                        }
                    });
                },
            );
            return map;
        });

        const indexRangesToHighlight = computed(() => {
            const result = [];
            props.textsToHighlight.forEach((textToSearch) => {
                const escapedTextToSearch = getEscapedText(textToSearch);
                const textIndices = getAllTextIndices(
                    props.text,
                    escapedTextToSearch,
                );

                textIndices.forEach((index) =>
                    result.push({
                        from: index,
                        to: index + textToSearch.length - 1,
                    }),
                );
            });
            return result;
        });

        function getAllTextIndices(texts, textToSearch) {
            return [...texts.matchAll(new RegExp(textToSearch, 'gi'))].map(
                (a) => a.index,
            );
        }

        function getEscapedText(text) {
            return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function getIndexFromElementId(elementId) {
            return elementId.split(`${BASE_CHARACTER_ID}`)[1];
        }

        function handleMouseUpEvent() {
            emitCurrentSelectedText();
        }

        function emitCurrentSelectedText() {
            const selection = window.getSelection();
            const localSelectedText = selection
                .toString()
                /*eslint-disable */
                .replaceAll(/ /g, '')
                /*eslint-enable */
                .replaceAll(/\n/g, '');

            if (localSelectedText.length < 2) {
                return;
            }

            const oRect = selection.getRangeAt(0).getBoundingClientRect();
            context.emit('text:selected', localSelectedText, oRect);
        }

        function handleClickEvent(event) {
            switch (event.detail) {
                case 1:
                    handleSingleClickEvent(event);
                    break;
                case 2:
                    handleDoubleClickEvent(event);
                    break;
            }
        }

        function handleSingleClickEvent(event) {
            const [targetElement] = event.composedPath();
            const targetIndex = +getIndexFromElementId(targetElement.id);
            const targetCharacter = targetElement.textContent;
            context.emit('text:clicked', {
                event,
                targetIndex,
                targetCharacter,
            });
        }

        function handleDoubleClickEvent(event) {
            let selection = window.getSelection();
            let parentNode =
                selection.anchorNode.parentNode.parentNode.parentNode;
            let containerNode = parentNode.parentNode;

            let range = new Range();
            const parentNodeId = +parentNode.id;
            const siblings = containerNode.childNodes;

            let startNodeIndex = null;
            for (let i = parentNodeId; i >= 0; i--) {
                if (getPlainText(siblings[i].textContent).length === 0) {
                    startNodeIndex = i + 1;
                    break;
                }
            }

            let endNodeIndex = null;
            for (
                let i = parentNodeId;
                i < containerNode.childNodes.length;
                i++
            ) {
                if (getPlainText(siblings[i].textContent).length === 0) {
                    endNodeIndex = i;
                    break;
                }
            }

            range.setStart(containerNode, startNodeIndex ? startNodeIndex : 0);
            range.setEnd(
                containerNode,
                endNodeIndex ? endNodeIndex : siblings.length - 1,
            );

            document.getSelection().removeAllRanges();
            document.getSelection().addRange(range);

            emitCurrentSelectedText();
        }

        return {
            indexRangesToHighlight,
            selectionColors,
            baseColorsIndexesMap,

            handleMouseUpEvent,
            handleClickEvent,
        };
    },
};
</script>

<template>
    <div class="easy-highlight-selectable-text">
        <div class="easy-highlight-selcttions-wrapper">
            <p
                class="easy-highlight-selectable-text-overlay"
                @mouseup="handleMouseUpEvent"
                @click="handleClickEvent"
            >
                <HighlightedText
                    :text="text"
                    :indexRangesToHighlight="indexRangesToHighlight"
                    :indexBaseColorMap="baseColorsIndexesMap"
                    :selectionColors="selectionColors"
                />
            </p>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.easy-highlight-selectable-text {
    position: relative;

    .easy-highlight-selcttions-wrapper {
        top: 0;
        width: 100%;

        .easy-highlight-selectable-text-overlay {
            top: 0;
            width: 100%;
            margin: 0;
        }
    }
}
</style>
