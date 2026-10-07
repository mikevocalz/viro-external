# Meta Ray-Ban Display UI parity

Meta's current Ray-Ban Display stack has a React UI Toolkit in `facebook/meta-ray-ban-display-ui-toolkit-web` and a separate Web Apps runtime in `facebook/meta-wearables-webapp`.

The shared contract tracks Container, Surface, Card/CardStack, TextView/TextSwitcher/ReadMoreTextView, ScrollView/VerticalList/Pager/Carousel, Button/ButtonGroup/ButtonRail, Switch/RadioButton/SliderBar/Scrubber, InputTextView, Divider/Chip/Tag, Header/Page/SubNavigation, Tooltip/ContextMenu/VerticalMenu/Modal/Toast, progress/pagination/swipe indicators, VolumeIndicator/ZoomIndicator, Avatar/badges, Shimmer, Vignette and ActionHint.

Meta Web Apps uses glasses-native directional focus and activation semantics. Those remain adapter concerns. `@viro-external/meta-wearables` remains the native device/capability boundary.
