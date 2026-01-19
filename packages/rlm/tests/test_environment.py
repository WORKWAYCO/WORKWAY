"""
Tests for RLM Environment
"""

import pytest
from workway_rlm import RLMEnvironment, ExecutionResult


def test_environment_initialization():
    """Test basic environment initialization."""
    context = "This is a test context with some sample data."
    env = RLMEnvironment(context=context)

    assert env._namespace["context"] == context
    assert "results" in env._namespace
    assert "re" in env._namespace
    assert "json" in env._namespace
    assert "chunk_text" in env._namespace
    assert "chunk_lines" in env._namespace


def test_simple_execution():
    """Test executing simple code in the environment."""
    context = "Hello world! This is a test."
    env = RLMEnvironment(context=context)

    result = env.execute("""
print("Context length:", len(context))
print("First 10 chars:", context[:10])
""")

    assert result.success is True
    assert "Context length: 28" in result.output
    assert "First 10 chars: Hello worl" in result.output
    assert result.error is None


def test_regex_filtering():
    """Test using regex to filter context."""
    context = """
error: Authentication failed
info: Request processed
error: Database connection lost
warning: Slow query detected
error: Timeout exceeded
"""
    env = RLMEnvironment(context=context)

    result = env.execute("""
import re
errors = re.findall(r'error: (.*)', context)
print(f"Found {len(errors)} errors")
for e in errors:
    print(f"  - {e}")
""")

    assert result.success is True
    assert "Found 3 errors" in result.output
    assert "Authentication failed" in result.output
    assert "Database connection lost" in result.output
    assert "Timeout exceeded" in result.output


def test_results_dict():
    """Test storing results in the results dict."""
    context = "Sample data for testing"
    env = RLMEnvironment(context=context)

    result = env.execute("""
results['context_length'] = len(context)
results['first_word'] = context.split()[0]
print(f"Stored {len(results)} results")
""")

    assert result.success is True
    assert "Stored 2 results" in result.output

    # Verify results were stored
    results_dict = env.get_variable("results")
    assert results_dict["context_length"] == 23
    assert results_dict["first_word"] == "Sample"


def test_chunk_text_helper():
    """Test the chunk_text helper function."""
    context = "a" * 25000  # 25K characters
    env = RLMEnvironment(context=context)

    result = env.execute("""
chunks = chunk_text(context, chunk_size=10000)
print(f"Split into {len(chunks)} chunks")
print(f"First chunk length: {len(chunks[0])}")
print(f"Last chunk length: {len(chunks[-1])}")
""")

    assert result.success is True
    assert "Split into 3 chunks" in result.output
    assert "First chunk length: 10000" in result.output
    assert "Last chunk length: 5000" in result.output


def test_chunk_lines_helper():
    """Test the chunk_lines helper function."""
    context = "\n".join([f"Line {i}" for i in range(250)])  # 250 lines
    env = RLMEnvironment(context=context)

    result = env.execute("""
chunks = chunk_lines(context, lines_per_chunk=100)
print(f"Split into {len(chunks)} chunks")
""")

    assert result.success is True
    assert "Split into 3 chunks" in result.output


def test_execution_error_handling():
    """Test that execution errors are caught and reported."""
    context = "test"
    env = RLMEnvironment(context=context)

    result = env.execute("""
# This will raise a NameError
print(undefined_variable)
""")

    assert result.success is False
    assert result.error is not None
    assert "NameError" in result.error


def test_list_context():
    """Test environment with list context."""
    context = [
        "Document 1: Authentication system",
        "Document 2: Rate limiting",
        "Document 3: Database schema",
    ]
    env = RLMEnvironment(context=context)

    result = env.execute("""
print(f"Number of documents: {len(context)}")
for i, doc in enumerate(context):
    print(f"  Doc {i}: {doc[:20]}...")
""")

    assert result.success is True
    assert "Number of documents: 3" in result.output
    assert "Doc 0: Document 1: Authenti..." in result.output


def test_context_info():
    """Test context_info property."""
    context = "a" * 100000
    env = RLMEnvironment(context=context)

    info = env.context_info
    assert info["type"] == "string"
    assert info["total_chars"] == 100000
    assert info["total_lines"] == 1

    # Test with list context
    context_list = ["doc1", "doc2", "doc3"]
    env_list = RLMEnvironment(context=context_list)

    info_list = env_list.context_info
    assert info_list["type"] == "list"
    assert info_list["num_items"] == 3


def test_max_output_truncation():
    """Test that output is truncated if too long."""
    context = "test"
    env = RLMEnvironment(context=context, max_output_chars=100)

    result = env.execute("""
for i in range(1000):
    print(f"Line {i}: This is a very long output line that will be truncated")
""")

    assert result.success is True
    assert len(result.output) <= 200  # Some buffer for truncation message
    assert "truncated" in result.output.lower()
