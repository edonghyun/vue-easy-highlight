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

function getDarkendColors(colorCode) {
    const colors = [colorCode, colorCode];
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
        higlightColor: {
            type: String,
            default: () => DEFAULT_HIGHLIGHT_COLOR,
        },
        highlightColors: {
            type: Array,
            default: () => [],
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

        const colors = computed(() =>
            props.highlightColors.length > 0
                ? props.highlightColors
                : getDarkendColors(props.highlightColors[0]),
        );

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
            const selection = window.getSelection();
            const localSelectedText = selection
                .toString()
                .replaceAll(/\n/g, '');
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
    <div class="selectable-text">
        <div class="selcttions-wrapper">
            <p
                class="selectable-text-overlay"
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
.selectable-text {
    position: relative;

    .selcttions-wrapper {
        top: 0;
        width: 100%;

        .selectable-text-overlay {
            top: 0;
            width: 100%;
        }
    }
}
</style>
