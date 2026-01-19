"""
WORKWAY RLM (Recursive Language Model)

Long-context processing for WORKWAY autonomous agents.
Based on MIT CSAIL's "Recursive Language Models" paper (arxiv:2512.24601).

Adapted from CREATE SOMETHING's implementation with attribution.
"""

from workway_rlm.environment import RLMEnvironment, ExecutionResult
from workway_rlm.session import RLMSession, RLMConfig, RLMResult

__all__ = [
    "RLMEnvironment",
    "ExecutionResult",
    "RLMSession",
    "RLMConfig",
    "RLMResult",
]

__version__ = "0.1.0"
