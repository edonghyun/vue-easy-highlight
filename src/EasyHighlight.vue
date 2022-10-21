<script>
import { computed } from 'vue';
import {
    DEFAULT_HIGHLIGHT_COLOR,
    DEFAULT_SELECTED_BACKGROUND_COLOR,
    DEFAULT_SELECTED_COLOR,
    MAX_COLOR_DARKNESS,
} from './config';
import HighlightedText from './HighlightedText';

function getPlainText(textData) {
    return textData.replace(/\s/g, '');
}

function getDarkendColors(colorCodes) {
    const colorCode = colorCodes[0];
    const colors = colorCodes;
    let color = Number(colorCode.replace('#', '0x'));
    for (let i = 0; i < MAX_COLOR_DARKNESS; i++) {
        color = color - 0x101010;
        if (color <= 0) {
            color = 0;
        }
        const stringifiedColor = color.toString(16);
        colors.push(
            stringifiedColor.length === 6 ? `#${stringifiedColor}` : '#000000',
        );
    }
    return colors;
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
        highlightColors: {
            type: Array,
            default: () => [DEFAULT_HIGHLIGHT_COLOR],
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

        const colors = computed(() => getDarkendColors(props.highlightColors));

        const indexRangesToHighlight = computed(() => {
            const result = [];
            props.textsToHighlight.forEach((textToSearch) => {
                const escapedTextToSearch = textToSearch.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&',
                );

                const textIndices = [
                    ...props.text.matchAll(
                        new RegExp(escapedTextToSearch, 'gi'),
                    ),
                ].map((a) => a.index);

                textIndices.forEach((index) =>
                    result.push({
                        from: index,
                        to: index + textToSearch.length - 1,
                    }),
                );
            });
            return result;
        });

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
                    handleSingleClickEvent();
                    break;
                case 2:
                    handleDoubleClickEvent();
                    break;
            }
        }

        function handleSingleClickEvent() {
            context.emit('text:clicked');
        }

        function handleDoubleClickEvent() {
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
            colors,

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
                    :highlightColors="colors"
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
