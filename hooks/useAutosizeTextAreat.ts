import { Dispatch, SetStateAction, useEffect } from "react";

// Updates the height of a <textarea> when the value changes.
const useAutosizeTextArea = (
  textAreaRef: HTMLTextAreaElement | null,
  value: string,
  setShowLimit: Dispatch<SetStateAction<boolean>>
) => {
  let scrollHeight;
  useEffect(() => {
    if (textAreaRef) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textarea
      textAreaRef.style.height = "0px";
      scrollHeight = textAreaRef.scrollHeight;

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      textAreaRef.style.height = scrollHeight + "px";
      if (scrollHeight >= 62) {
        setShowLimit(true);
      } else if (scrollHeight < 62) {
        setShowLimit(false);
      }
    }
  }, [textAreaRef, value]);
};

export default useAutosizeTextArea;
