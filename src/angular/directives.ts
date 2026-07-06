/**
 * Standalone Angular attribute directives (source-only — copy into your app or
 * import from source until decorator bundling ships in dist).
 *
 * Usage after copying:
 * ```html
 * <div [kilidKeybinding]="binding" [kilidKeybindingHandler]="save"></div>
 * ```
 */
import {
  Directive,
  ElementRef,
  Input,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import type { KeybindingHandler } from '../keyboard.js';
import { bindKeybinding } from './kilid-keybinding.directive.js';

@Directive({
  selector: '[kilidKeybinding]',
  standalone: true,
})
export class KilidKeybindingDirective implements OnInit, OnDestroy {
  @Input({ required: true }) kilidKeybinding!: number;
  @Input() kilidKeybindingHandler: KeybindingHandler = () => {};
  @Input() kilidKeybindingWhen?: () => boolean;
  @Input() kilidKeybindingEnabled = true;
  @Input() kilidKeybindingPreventDefault?: boolean;
  @Input() kilidKeybindingStopPropagation?: boolean;
  @Input() kilidKeybindingCapture?: boolean;
  @Input() kilidKeybindingIsMac?: boolean;
  @Input() kilidKeybindingChordTimeout?: number;

  private cleanup?: () => void;

  constructor(private readonly elementRef: ElementRef<EventTarget>) {}

  ngOnInit(): void {
    this.cleanup = bindKeybinding(
      this.elementRef.nativeElement,
      this.kilidKeybinding,
      (...args) => this.kilidKeybindingHandler(...args),
      {
        when: this.kilidKeybindingWhen,
        enabled: this.kilidKeybindingEnabled,
        preventDefault: this.kilidKeybindingPreventDefault,
        stopPropagation: this.kilidKeybindingStopPropagation,
        capture: this.kilidKeybindingCapture,
        isMac: this.kilidKeybindingIsMac,
        chordTimeout: this.kilidKeybindingChordTimeout,
      }
    );
  }

  ngOnDestroy(): void {
    this.cleanup?.();
  }
}
