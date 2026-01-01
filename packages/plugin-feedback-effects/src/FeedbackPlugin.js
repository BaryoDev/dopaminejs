import { FeedbackSystem } from './FeedbackSystem.js';

/**
 * Plugin that provides high-level feedback effects.
 */
export const FeedbackPlugin = {
    name: 'feedback-effects',

    init(kernel) {
        const system = new FeedbackSystem(kernel);
        kernel.systems.register('feedback', system);
    }
};
