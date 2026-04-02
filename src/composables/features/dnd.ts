import { reactive, Reactive } from "vue"

export const useDnd = () : Reactive<DndInterface> => {
    const state = reactive<DndStateInterface>({
        dragging: false,
    });


    const onDragStart = (event: PointerEvent) => {
        state.dragging = true;
    }

    const onDragEnd = (event: PointerEvent) => {
        state.dragging = false;
    }

    return {
        state,
        onDragStart,
        onDragEnd
    };
}

export type UseDndType = ReturnType<typeof useDnd>;

export interface DndInterface {
    state: DndStateInterface,
    onDragStart: (event: PointerEvent) => void,
    onDragEnd: (event: PointerEvent) => void
}

export interface DndStateInterface {
    dragging: boolean,
}