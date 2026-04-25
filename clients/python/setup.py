from setuptools import setup, find_packages

setup(
    name="promptmetrics",
    version="1.0.0",
    description="Python SDK for PromptMetrics",
    packages=find_packages(),
    install_requires=["httpx>=0.27.0"],
    python_requires=">=3.10",
)
