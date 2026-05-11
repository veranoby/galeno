# Accessibility Guidelines for PiP Implementation

This document outlines the accessibility considerations and best practices for the Picture-in-Picture functionality in the Galeno platform.

## WCAG Compliance

Our PiP implementation follows WCAG 2.1 AA guidelines:

### Success Criteria Addressed
- **1.1.1 Non-text Content**: All icons have appropriate alternative text
- **1.3.1 Info and Relationships**: Semantic HTML structure maintained
- **1.4.12 Text Spacing**: Adequate spacing for readability
- **2.1.1 Keyboard Accessible**: Full keyboard navigation support
- **2.4.3 Focus Order**: Logical focus progression
- **2.4.7 Focus Visible**: Clear focus indicators
- **4.1.2 Name, Role, Value**: Proper ARIA attributes

## Keyboard Navigation

### PiP Controls
- PiP toggle buttons are accessible via Tab key
- Space/Enter keys activate PiP controls
- Focus management during PiP transitions
- Escape key exits PiP mode when appropriate

### Focus Management
```javascript
// Example focus management during PiP transitions
const togglePiP = async () => {
  if (isPiPActive.value) {
    exitPiP();
    // Return focus to the toggle button
    pipToggleButtonRef.value?.focus();
  } else {
    await enterPiP();
    // Focus remains on the PiP window or appropriate fallback
  }
};
```

## Screen Reader Support

### ARIA Labels
- Dynamic ARIA labels that change based on PiP state
- Descriptive labels for all interactive elements
- Live regions for PiP status updates

### Announcements
- Screen readers announce PiP state changes
- Clear instructions for keyboard users
- Status updates for loading/error states

## Color and Contrast

### Minimum Contrast Ratios
- Normal text: 4.5:1 against background
- Large text: 3:1 against background
- User interface components: 3:1 contrast

### Visual Indicators
- Clear visual feedback for interactive elements
- Distinguishable states (normal, hover, focus, active)
- Consistent styling across components

## Responsive Design

### Touch Targets
- Minimum 44px touch targets for mobile devices
- Adequate spacing between interactive elements
- Responsive PiP window sizing

### Zoom Support
- Maintains usability at 200% zoom
- Preserves functionality on various screen sizes
- Adapts to different viewport dimensions

## Testing Checklist

### Manual Testing
- [ ] Navigate using only keyboard
- [ ] Verify screen reader announcements
- [ ] Test with high contrast mode
- [ ] Validate focus order and visibility
- [ ] Check functionality at different zoom levels

### Automated Testing
- [ ] Run axe-core accessibility tests
- [ ] Validate HTML markup
- [ ] Check ARIA attribute usage
- [ ] Verify color contrast ratios

## Common Issues and Solutions

### Issue: Hidden Elements in PiP Mode
**Solution**: Ensure important content remains accessible when video enters PiP mode

### Issue: Focus Traps
**Solution**: Maintain logical focus flow between main content and PiP controls

### Issue: Insufficient Color Contrast
**Solution**: Use tools like the axe extension to verify contrast ratios

## Assistive Technology Compatibility

### Screen Readers
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

### Keyboard Navigation Tools
- Dragon NaturallySpeaking
- Switch controls
- Eye-tracking devices

## Implementation Best Practices

### Semantic HTML
```vue
<!-- Use semantic elements -->
<button 
  @click="togglePiP"
  :aria-pressed="isPiPActive"
  aria-label="Toggle Picture-in-Picture"
>
  <!-- Icon -->
</button>
```

### Progressive Enhancement
- Start with basic functionality
- Enhance with PiP features when supported
- Provide graceful degradation

### User Preferences
- Respect user's reduced motion preferences
- Allow customization of PiP behavior
- Provide clear instructions

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [ARIA Authoring Practices](https://www.w3.org/TR/wai-aria-practices-1.2/)
- [MDN Accessibility Documentation](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Conclusion

Accessibility is integral to the PiP implementation in Galeno. Regular testing and continuous improvement ensure that all users can benefit from the enhanced telemedicine experience, regardless of their abilities or assistive technologies used.